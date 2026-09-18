import { Prisma, ReferenceType, StockMovementType } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { resolvePagination, buildMeta } from '../utils/pagination';

type TxClient = Prisma.TransactionClient;

/**
 * The product-warehouse "assignment" a product becomes locked to once it has stock recorded
 * there - reuses the existing Inventory relationship (one row per product+warehouse) rather
 * than a second assignment table, so this is the single place that rule is enforced.
 *
 * `allowNewAssignment: true` (purchases, stock increases) also permits a product that has
 * never been assigned to *any* warehouse yet, since that first stock record is how an
 * assignment gets created in the first place. It still blocks moving a product that's already
 * assigned elsewhere into a different warehouse it isn't assigned to.
 * `allowNewAssignment: false` (consumption, wastage, decreases, transfer-out) requires the
 * product to already be assigned to this exact warehouse, since those only ever use stock
 * that's supposed to already be there.
 */
export async function assertProductWarehouseAssignment(
  client: TxClient | typeof prisma,
  productId: string,
  warehouseId: string,
  allowNewAssignment: boolean,
): Promise<void> {
  const inventory = await client.inventory.findUnique({ where: { productId_warehouseId: { productId, warehouseId } } });
  if (inventory) return;

  if (allowNewAssignment) {
    const assignedElsewhere = await client.inventory.findFirst({ where: { productId } });
    if (!assignedElsewhere) return; // never assigned anywhere - this is its first assignment
  }

  const [product, warehouse] = await Promise.all([
    client.product.findUnique({ where: { id: productId }, select: { name: true } }),
    client.warehouse.findUnique({ where: { id: warehouseId }, select: { name: true } }),
  ]);
  throw AppError.badRequest(
    `"${product?.name ?? productId}" is not assigned to "${warehouse?.name ?? warehouseId}"`,
    'PRODUCT_NOT_ASSIGNED_TO_WAREHOUSE',
  );
}

/** How far out an active batch's expiry counts as "near expiry" for warnings/filters. */
const NEAR_EXPIRY_DAYS = 7;

/** Stock uses (as opposed to internal corrections/transfers/write-offs) that must not be fulfilled from already-expired batches. */
const BLOCKS_EXPIRED_STOCK: StockMovementType[] = ['SALE', 'CONSUMPTION', 'PRODUCTION_CONSUME'];

export interface ConsumedBatch {
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  expiryDate: Date | null;
  batchNumber: string | null;
}

export interface ApplyStockMovementInput {
  productId: string;
  warehouseId: string;
  type: StockMovementType;
  /** Signed quantity: positive increases stock, negative decreases it. */
  signedQuantity: number;
  unitCost?: number;
  referenceType?: ReferenceType;
  referenceId?: string;
  reason?: string;
  createdById: string;
  allowNegative?: boolean;
  /** Inflow only: expiry/batch label for the single new batch this movement creates (e.g. a purchase receipt). */
  expiryDate?: Date;
  batchNumber?: string;
  /** Inflow only: replicate these exact batches instead of one lump batch, so a TRANSFER_IN preserves the expiry dates of the TRANSFER_OUT batches it came from. */
  batchesIn?: ConsumedBatch[];
}

/**
 * FEFO (First Expired, First Out): deduct `requested` quantity from a product/warehouse's
 * active batches, soonest expiry first, batches with no expiry last (oldest received first
 * among those). Returns what was actually drawn from each batch.
 */
async function consumeBatchesFefo(
  tx: TxClient,
  opts: { productId: string; warehouseId: string; requested: Prisma.Decimal; blockExpired: boolean },
): Promise<ConsumedBatch[]> {
  const { productId, warehouseId, requested, blockExpired } = opts;
  const now = new Date();

  const batches = await tx.inventoryBatch.findMany({
    where: { productId, warehouseId, quantity: { gt: 0 } },
    orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { receivedDate: 'asc' }],
  });

  if (blockExpired) {
    const nonExpiredAvailable = batches
      .filter((b) => !b.expiryDate || b.expiryDate >= now)
      .reduce((sum, b) => sum.add(b.quantity), new Prisma.Decimal(0));
    if (nonExpiredAvailable.lessThan(requested)) {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { name: true } });
      throw AppError.conflict(
        `Cannot use "${product?.name ?? productId}" - available stock includes expired batches. Record a wastage report for the expired stock first.`,
        'EXPIRED_STOCK',
      );
    }
  }

  let remaining = requested;
  const consumed: ConsumedBatch[] = [];
  for (const batch of batches) {
    if (remaining.lessThanOrEqualTo(0)) break;
    const deduct = Prisma.Decimal.min(batch.quantity, remaining);
    if (deduct.lessThanOrEqualTo(0)) continue;
    await tx.inventoryBatch.update({ where: { id: batch.id }, data: { quantity: batch.quantity.sub(deduct) } });
    consumed.push({ quantity: deduct, unitCost: batch.unitCost, expiryDate: batch.expiryDate, batchNumber: batch.batchNumber });
    remaining = remaining.sub(deduct);
  }
  // Any shortfall belongs to stock that predates batch tracking (already reflected in the
  // aggregate Inventory.quantity) - nothing further to draw from.
  return consumed;
}

/**
 * The single choke point for every inventory-affecting operation.
 * Always runs inside a transaction supplied by the caller so that the
 * inventory row update, batch bookkeeping, and stock movement record are atomic.
 */
export async function applyStockMovement(tx: TxClient, input: ApplyStockMovementInput) {
  const {
    productId,
    warehouseId,
    type,
    signedQuantity,
    unitCost,
    referenceType,
    referenceId,
    reason,
    createdById,
    allowNegative = false,
    expiryDate,
    batchNumber,
    batchesIn,
  } = input;

  if (signedQuantity === 0) {
    throw AppError.badRequest('Stock movement quantity cannot be zero');
  }

  let inventory = await tx.inventory.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });

  if (!inventory) {
    inventory = await tx.inventory.create({
      data: { productId, warehouseId, quantity: 0, averageCost: 0 },
    });
  }

  const previousQuantity = inventory.quantity;
  const newQuantityDecimal = previousQuantity.add(signedQuantity);

  if (newQuantityDecimal.lessThan(0) && !allowNegative) {
    const product = await tx.product.findUnique({ where: { id: productId }, select: { name: true } });
    throw AppError.conflict(
      `Insufficient stock for "${product?.name ?? productId}". Available: ${previousQuantity.toString()}, requested: ${Math.abs(signedQuantity)}`,
      'INSUFFICIENT_STOCK',
    );
  }

  let consumedBatches: ConsumedBatch[] | undefined;

  if (signedQuantity < 0) {
    consumedBatches = await consumeBatchesFefo(tx, {
      productId,
      warehouseId,
      requested: new Prisma.Decimal(-signedQuantity),
      blockExpired: BLOCKS_EXPIRED_STOCK.includes(type),
    });
  } else if (batchesIn && batchesIn.length > 0) {
    await tx.inventoryBatch.createMany({
      data: batchesIn.map((b) => ({
        productId,
        warehouseId,
        quantity: b.quantity,
        unitCost: b.unitCost,
        expiryDate: b.expiryDate ?? undefined,
        batchNumber: b.batchNumber ?? undefined,
      })),
    });
  } else {
    await tx.inventoryBatch.create({
      data: {
        productId,
        warehouseId,
        quantity: new Prisma.Decimal(signedQuantity),
        unitCost: unitCost !== undefined ? unitCost : inventory.averageCost,
        expiryDate: expiryDate ?? undefined,
        batchNumber: batchNumber ?? undefined,
      },
    });
  }

  let newAverageCost = inventory.averageCost;
  // Purchases bring in a new cost basis; transfers carry the source warehouse's existing cost
  // basis into the destination; a production yield brings in the finished product's computed
  // production cost. Either way, blend it into the running weighted-average cost.
  if (signedQuantity > 0 && unitCost !== undefined && (type === 'PURCHASE' || type === 'TRANSFER_IN' || type === 'PRODUCTION_YIELD')) {
    const existingValue = previousQuantity.mul(inventory.averageCost);
    const incomingValue = new Prisma.Decimal(signedQuantity).mul(unitCost);
    const totalQty = previousQuantity.add(signedQuantity);
    newAverageCost = totalQty.greaterThan(0) ? existingValue.add(incomingValue).div(totalQty) : new Prisma.Decimal(unitCost);
  }

  const updatedInventory = await tx.inventory.update({
    where: { id: inventory.id },
    data: {
      quantity: newQuantityDecimal,
      averageCost: newAverageCost,
    },
  });

  const movement = await tx.stockMovement.create({
    data: {
      productId,
      warehouseId,
      type,
      quantity: signedQuantity,
      unitCost: unitCost !== undefined ? unitCost : undefined,
      previousQuantity,
      newQuantity: newQuantityDecimal,
      referenceType,
      referenceId,
      reason,
      createdById,
    },
  });

  return { inventory: updatedInventory, movement, consumedBatches };
}

export interface ExpiryInfo {
  nearestExpiry: Date | null;
  isExpired: boolean;
  isNearExpiry: boolean;
}

/** Nearest (soonest) expiry among each product/warehouse's active batches, keyed by "productId:warehouseId". Non-perishable products, and batches with no expiry, simply don't appear. */
export async function getNearestExpiryMap(pairs: { productId: string; warehouseId: string }[]): Promise<Map<string, ExpiryInfo>> {
  const map = new Map<string, ExpiryInfo>();
  if (pairs.length === 0) return map;

  const now = new Date();
  const nearExpiryThreshold = new Date(now.getTime() + NEAR_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const grouped = await prisma.inventoryBatch.groupBy({
    by: ['productId', 'warehouseId'],
    where: {
      quantity: { gt: 0 },
      expiryDate: { not: null },
      OR: pairs.map((p) => ({ productId: p.productId, warehouseId: p.warehouseId })),
    },
    _min: { expiryDate: true },
  });

  for (const g of grouped) {
    const nearestExpiry = g._min.expiryDate;
    map.set(`${g.productId}:${g.warehouseId}`, {
      nearestExpiry,
      isExpired: !!nearestExpiry && nearestExpiry < now,
      isNearExpiry: !!nearestExpiry && nearestExpiry >= now && nearestExpiry <= nearExpiryThreshold,
    });
  }
  return map;
}

export async function listInventory(query: {
  page?: number;
  limit?: number;
  warehouseId?: string;
  lowStock?: boolean;
  expiringSoon?: boolean;
  expired?: boolean;
  search?: string;
}) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.InventoryWhereInput = {
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.search
      ? { product: { name: { contains: query.search, mode: 'insensitive' } } }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: 'desc' },
      include: {
        product: { include: { unit: true, category: true } },
        warehouse: true,
      },
    }),
    prisma.inventory.count({ where }),
  ]);

  const expiryMap = await getNearestExpiryMap(rows.map((r) => ({ productId: r.productId, warehouseId: r.warehouseId })));
  const noExpiry: ExpiryInfo = { nearestExpiry: null, isExpired: false, isNearExpiry: false };

  let data = rows.map((r) => ({ ...r, ...(expiryMap.get(`${r.productId}:${r.warehouseId}`) ?? noExpiry) }));

  if (query.lowStock) {
    data = data.filter((r) => r.quantity.lessThanOrEqualTo(r.product.minimumStock));
  }
  if (query.expiringSoon) {
    data = data.filter((r) => r.isNearExpiry);
  }
  if (query.expired) {
    data = data.filter((r) => r.isExpired);
  }

  return { data, meta: buildMeta(total, page, limit) };
}

export async function getLowStockItems() {
  const rows = await prisma.inventory.findMany({
    include: { product: { include: { unit: true, category: true } }, warehouse: true },
  });
  return rows.filter((r) => r.quantity.lessThanOrEqualTo(r.product.minimumStock));
}

export async function getInventoryValue(): Promise<number> {
  const rows = await prisma.inventory.findMany({ select: { quantity: true, averageCost: true } });
  return rows.reduce((sum, r) => sum + r.quantity.mul(r.averageCost).toNumber(), 0);
}

import { Prisma, ReferenceType, StockMovementType } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { resolvePagination, buildMeta } from '../utils/pagination';

type TxClient = Prisma.TransactionClient;

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
  expiryDate?: Date;
  batchNumber?: string;
}

/**
 * The single choke point for every inventory-affecting operation.
 * Always runs inside a transaction supplied by the caller so that the
 * inventory row update and the stock movement record are atomic.
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

  let newAverageCost = inventory.averageCost;
  // Purchases bring in a new cost basis; transfers carry the source warehouse's existing cost
  // basis into the destination. Either way, blend it into the running weighted-average cost.
  if (signedQuantity > 0 && unitCost !== undefined && (type === 'PURCHASE' || type === 'TRANSFER_IN')) {
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
      ...(expiryDate ? { expiryDate } : {}),
      ...(batchNumber ? { batchNumber } : {}),
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

  return { inventory: updatedInventory, movement };
}

export async function listInventory(query: {
  page?: number;
  limit?: number;
  warehouseId?: string;
  lowStock?: boolean;
  expiringSoon?: boolean;
  search?: string;
}) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.InventoryWhereInput = {
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.search
      ? { product: { name: { contains: query.search, mode: 'insensitive' } } }
      : {}),
    ...(query.expiringSoon
      ? { expiryDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), not: null } }
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

  let data = rows;
  if (query.lowStock) {
    data = rows.filter((r) => r.quantity.lessThanOrEqualTo(r.product.minimumStock));
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

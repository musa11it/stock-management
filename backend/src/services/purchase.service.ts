import { Prisma, PurchaseStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { resolvePagination, buildMeta } from '../utils/pagination';
import { writeAuditLog } from './auditLog.service';
import { applyStockMovement, assertProductWarehouseAssignment } from './inventory.service';
import { generateDocNumber } from '../utils/docNumber';

const purchaseInclude = {
  supplier: true,
  warehouse: true,
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  items: { include: { product: { include: { unit: true } } } },
} satisfies Prisma.PurchaseInclude;

export interface PurchaseItemInput {
  productId: string;
  quantity: number;
  unitCost: number;
  /** Optional supplier lot label, carried onto the InventoryBatch created when this item is received. */
  batchNumber?: string;
}

export interface CreatePurchaseInput {
  supplierId: string;
  warehouseId: string;
  invoiceNumber?: string;
  purchaseDate?: Date;
  tax?: number;
  discount?: number;
  notes?: string;
  items: PurchaseItemInput[];
}

function computeTotals(items: PurchaseItemInput[], tax = 0, discount = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const total = subtotal + tax - discount;
  return { subtotal, total };
}

export async function listPurchases(query: {
  page?: number;
  limit?: number;
  status?: PurchaseStatus;
  supplierId?: string;
  warehouseId?: string;
  search?: string;
}) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.PurchaseWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.search
      ? { OR: [{ purchaseNumber: { contains: query.search, mode: 'insensitive' } }, { invoiceNumber: { contains: query.search, mode: 'insensitive' } }] }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.purchase.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: purchaseInclude }),
    prisma.purchase.count({ where }),
  ]);
  return { data, meta: buildMeta(total, page, limit) };
}

export async function getPurchaseById(id: string) {
  const purchase = await prisma.purchase.findUnique({ where: { id }, include: purchaseInclude });
  if (!purchase) throw AppError.notFound('Purchase not found');
  return purchase;
}

export async function createPurchase(input: CreatePurchaseInput, actorId: string) {
  const products = await prisma.product.findMany({ where: { id: { in: input.items.map((i) => i.productId) } } });
  if (products.length !== new Set(input.items.map((i) => i.productId)).size) {
    throw AppError.badRequest('One or more products are invalid', 'INVALID_PRODUCT');
  }

  // A purchase can be a product's first-ever assignment to a warehouse, but it can't be used to
  // move a product already assigned elsewhere into a warehouse it isn't assigned to.
  for (const item of input.items) {
    await assertProductWarehouseAssignment(prisma, item.productId, input.warehouseId, true);
  }

  const { subtotal, total } = computeTotals(input.items, input.tax ?? 0, input.discount ?? 0);

  const purchase = await prisma.purchase.create({
    data: {
      purchaseNumber: generateDocNumber('PO'),
      supplierId: input.supplierId,
      warehouseId: input.warehouseId,
      invoiceNumber: input.invoiceNumber,
      purchaseDate: input.purchaseDate ?? new Date(),
      tax: input.tax ?? 0,
      discount: input.discount ?? 0,
      subtotal,
      total,
      notes: input.notes,
      status: 'PENDING',
      createdById: actorId,
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          total: item.quantity * item.unitCost,
          batchNumber: item.batchNumber,
        })),
      },
    },
    include: purchaseInclude,
  });

  await writeAuditLog({ userId: actorId, action: 'PURCHASE_CREATED', entity: 'Purchase', entityId: purchase.id, newValue: purchase });
  return purchase;
}

export async function updatePurchase(
  id: string,
  input: Partial<Omit<CreatePurchaseInput, 'warehouseId'>> & { status?: 'DRAFT' | 'PENDING' | 'CANCELLED' },
  actorId: string,
) {
  const existing = await getPurchaseById(id);
  if (existing.status === 'RECEIVED' || existing.status === 'PARTIALLY_RECEIVED') {
    throw AppError.conflict('Cannot modify a purchase that has already been received', 'PURCHASE_ALREADY_RECEIVED');
  }

  const data: Prisma.PurchaseUpdateInput = {
    invoiceNumber: input.invoiceNumber,
    purchaseDate: input.purchaseDate,
    notes: input.notes,
    status: input.status,
  };

  if (input.items) {
    const { subtotal, total } = computeTotals(input.items, input.tax ?? Number(existing.tax), input.discount ?? Number(existing.discount));
    data.subtotal = subtotal;
    data.total = total;
    data.tax = input.tax ?? existing.tax;
    data.discount = input.discount ?? existing.discount;
  }

  const purchase = await prisma.$transaction(async (tx) => {
    if (input.items) {
      for (const item of input.items) {
        await assertProductWarehouseAssignment(tx, item.productId, existing.warehouseId, true);
      }
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
      await tx.purchaseItem.createMany({
        data: input.items!.map((item) => ({
          purchaseId: id,
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          total: item.quantity * item.unitCost,
          batchNumber: item.batchNumber,
        })),
      });
    }
    return tx.purchase.update({ where: { id }, data, include: purchaseInclude });
  });

  await writeAuditLog({ userId: actorId, action: 'PURCHASE_UPDATED', entity: 'Purchase', entityId: id, oldValue: existing, newValue: purchase });
  return purchase;
}

export interface ReceivePurchaseInput {
  items?: { productId: string; receivedQty: number }[];
}

export async function receivePurchase(id: string, input: ReceivePurchaseInput, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({ where: { id }, include: { items: true } });
    if (!purchase) throw AppError.notFound('Purchase not found');
    if (purchase.status === 'RECEIVED') throw AppError.conflict('Purchase has already been fully received', 'ALREADY_RECEIVED');
    if (purchase.status === 'CANCELLED') throw AppError.conflict('Cannot receive a cancelled purchase', 'PURCHASE_CANCELLED');

    const overrideMap = new Map((input.items ?? []).map((i) => [i.productId, i.receivedQty]));

    const products = await tx.product.findMany({
      where: { id: { in: purchase.items.map((i) => i.productId) } },
      select: { id: true, isPerishable: true, shelfLifeDays: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Expiry is never entered by hand - it's computed the moment stock actually arrives, so the
    // same product received on different dates ends up with different, correctly-dated batches.
    const receivedDate = new Date();

    for (const item of purchase.items) {
      const remaining = item.quantity.sub(item.receivedQty);
      if (remaining.lessThanOrEqualTo(0)) continue;

      const requested = overrideMap.has(item.productId) ? new Prisma.Decimal(overrideMap.get(item.productId)!) : remaining;
      const qtyToReceive = requested.greaterThan(remaining) ? remaining : requested;
      if (qtyToReceive.lessThanOrEqualTo(0)) continue;

      const product = productMap.get(item.productId);
      const expiryDate =
        product?.isPerishable && product.shelfLifeDays
          ? new Date(receivedDate.getTime() + product.shelfLifeDays * 24 * 60 * 60 * 1000)
          : undefined;

      await applyStockMovement(tx, {
        productId: item.productId,
        warehouseId: purchase.warehouseId,
        type: 'PURCHASE',
        signedQuantity: qtyToReceive.toNumber(),
        unitCost: item.unitCost.toNumber(),
        referenceType: 'PURCHASE',
        referenceId: purchase.id,
        reason: `Purchase ${purchase.purchaseNumber} received`,
        createdById: actorId,
        expiryDate,
        batchNumber: item.batchNumber ?? undefined,
      });

      await tx.purchaseItem.update({
        where: { id: item.id },
        data: { receivedQty: item.receivedQty.add(qtyToReceive) },
      });
    }

    const refreshedItems = await tx.purchaseItem.findMany({ where: { purchaseId: id } });
    const fullyReceived = refreshedItems.every((i) => i.receivedQty.greaterThanOrEqualTo(i.quantity));
    const anyReceived = refreshedItems.some((i) => i.receivedQty.greaterThan(0));
    const status: PurchaseStatus = fullyReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : purchase.status;

    // Bill for what actually arrived, not what was ordered: recompute the subtotal/total from
    // received quantities. Tax and discount are kept as originally entered (flat invoice amounts,
    // not auto-prorated) since a short delivery doesn't necessarily change what a supplier charges
    // for either.
    const receivedSubtotal = refreshedItems.reduce((sum, i) => sum.add(i.receivedQty.mul(i.unitCost)), new Prisma.Decimal(0));
    const receivedTotal = receivedSubtotal.add(purchase.tax).sub(purchase.discount);

    const updated = await tx.purchase.update({
      where: { id },
      data: {
        status,
        receivedAt: fullyReceived ? new Date() : purchase.receivedAt,
        subtotal: receivedSubtotal,
        total: receivedTotal,
      },
      include: purchaseInclude,
    });

    await writeAuditLog(
      { userId: actorId, action: 'PURCHASE_RECEIVED', entity: 'Purchase', entityId: id, newValue: { status } },
      tx,
    );

    return updated;
  });
}

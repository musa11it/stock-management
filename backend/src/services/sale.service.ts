import { Prisma, PaymentMethod, SaleStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { resolvePagination, buildMeta } from '../utils/pagination';
import { writeAuditLog } from './auditLog.service';
import { applyStockMovement } from './inventory.service';
import { generateDocNumber } from '../utils/docNumber';
import { getDefaultWarehouseId } from './warehouse.service';

const saleInclude = {
  warehouse: true,
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  customer: { select: { id: true, firstName: true, lastName: true, email: true } },
  items: { include: { menuItem: true } },
} satisfies Prisma.SaleInclude;

export interface SaleItemInput {
  menuItemId: string;
  quantity: number;
}

export interface CreateSaleInput {
  warehouseId: string;
  discount?: number;
  tax?: number;
  paymentMethod?: PaymentMethod;
  customerName?: string;
  items: SaleItemInput[];
}

type TxClient = Prisma.TransactionClient;

/** Shared core: validate items, compute totals, create the Sale + items, deduct recipe stock. */
async function buildAndCreateSale(
  tx: TxClient,
  input: { warehouseId: string; discount?: number; tax?: number; paymentMethod?: PaymentMethod; customerName?: string; items: SaleItemInput[] },
  meta: { createdById: string; customerId?: string; status: SaleStatus; source: 'POS' | 'ONLINE' },
) {
  const menuItemIds = input.items.map((i) => i.menuItemId);
  const menuItems = await tx.menuItem.findMany({
    where: { id: { in: menuItemIds } },
    include: { recipe: { include: { ingredients: { include: { product: true } } } } },
  });

  if (menuItems.length !== new Set(menuItemIds).size) {
    throw AppError.badRequest('One or more menu items are invalid', 'INVALID_MENU_ITEM');
  }

  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));
  let subtotal = 0;
  const itemsData = input.items.map((item) => {
    const menuItem = menuItemMap.get(item.menuItemId)!;
    if (!menuItem.isActive) {
      throw AppError.badRequest(`Menu item "${menuItem.name}" is not currently available`, 'MENU_ITEM_INACTIVE');
    }
    const unitPrice = menuItem.price.toNumber();
    const total = unitPrice * item.quantity;
    subtotal += total;
    return { menuItemId: item.menuItemId, quantity: item.quantity, unitPrice, total, menuItem };
  });

  const tax = input.tax ?? 0;
  const discount = input.discount ?? 0;
  const total = subtotal + tax - discount;

  const sale = await tx.sale.create({
    data: {
      saleNumber: generateDocNumber('SAL'),
      warehouseId: input.warehouseId,
      subtotal,
      tax,
      discount,
      total,
      paymentMethod: input.paymentMethod ?? 'CASH',
      customerName: input.customerName,
      customerId: meta.customerId,
      createdById: meta.createdById,
      status: meta.status,
      source: meta.source,
      items: {
        create: itemsData.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.total,
        })),
      },
    },
    include: saleInclude,
  });

  // Deduct recipe ingredients from stock for every sold item that has a recipe defined -
  // stock reflects the order the moment it's placed, whether it's a POS sale or a customer order.
  for (const item of itemsData) {
    const recipe = item.menuItem.recipe;
    if (!recipe) continue;
    for (const ingredient of recipe.ingredients) {
      await applyStockMovement(tx, {
        productId: ingredient.productId,
        warehouseId: input.warehouseId,
        type: 'SALE',
        signedQuantity: -ingredient.quantity.toNumber() * item.quantity,
        unitCost: ingredient.product.costPrice.toNumber(),
        referenceType: 'SALE',
        referenceId: sale.id,
        reason: `Sale ${sale.saleNumber}`,
        createdById: meta.createdById,
      });
    }
  }

  return sale;
}

export async function createSale(input: CreateSaleInput, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const sale = await buildAndCreateSale(tx, input, { createdById: actorId, status: 'COMPLETED', source: 'POS' });
    await writeAuditLog({ userId: actorId, action: 'SALE_CREATED', entity: 'Sale', entityId: sale.id, newValue: sale }, tx);
    return sale;
  });
}

export interface CreateCustomerOrderInput {
  discount?: number;
  tax?: number;
  paymentMethod?: PaymentMethod;
  items: SaleItemInput[];
}

/** A retail customer placing their own order - no warehouse picker, tracked by customerId, starts PENDING. */
export async function createCustomerOrder(input: CreateCustomerOrderInput, customerId: string) {
  return prisma.$transaction(async (tx) => {
    const warehouseId = await getDefaultWarehouseId(tx);
    const sale = await buildAndCreateSale(
      tx,
      { ...input, warehouseId },
      { createdById: customerId, customerId, status: 'PENDING', source: 'ONLINE' },
    );
    await writeAuditLog({ userId: customerId, action: 'SALE_CREATED', entity: 'Sale', entityId: sale.id, newValue: sale }, tx);
    return sale;
  });
}

const SALE_STATUS_TRANSITIONS: Record<SaleStatus, SaleStatus[]> = {
  PENDING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['CANCELLED'],
  CANCELLED: [],
};

/** Staff-side: fulfill (PENDING -> COMPLETED) or cancel (PENDING|COMPLETED -> CANCELLED) a sale/order. */
export async function updateSaleStatus(id: string, targetStatus: 'COMPLETED' | 'CANCELLED', actorId: string) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id },
      include: { items: { include: { menuItem: { include: { recipe: { include: { ingredients: { include: { product: true } } } } } } } } },
    });
    if (!sale) throw AppError.notFound('Sale not found');

    if (!SALE_STATUS_TRANSITIONS[sale.status].includes(targetStatus)) {
      throw AppError.conflict(`Cannot move a ${sale.status.toLowerCase()} sale to ${targetStatus.toLowerCase()}`, 'INVALID_SALE_STATUS');
    }

    if (targetStatus === 'CANCELLED') {
      // Stock was deducted exactly once at creation (PENDING or COMPLETED alike) - reverse it now.
      for (const item of sale.items) {
        const recipe = item.menuItem.recipe;
        if (!recipe) continue;
        for (const ingredient of recipe.ingredients) {
          await applyStockMovement(tx, {
            productId: ingredient.productId,
            warehouseId: sale.warehouseId,
            type: 'ADJUSTMENT',
            signedQuantity: ingredient.quantity.toNumber() * item.quantity,
            unitCost: ingredient.product.costPrice.toNumber(),
            referenceType: 'SALE',
            referenceId: sale.id,
            reason: `Sale ${sale.saleNumber} cancelled - stock reversed`,
            createdById: actorId,
          });
        }
      }
    }

    const updated = await tx.sale.update({ where: { id }, data: { status: targetStatus }, include: saleInclude });
    await writeAuditLog(
      { userId: actorId, action: targetStatus === 'CANCELLED' ? 'SALE_CANCELLED' : 'SALE_FULFILLED', entity: 'Sale', entityId: id },
      tx,
    );
    return updated;
  });
}

/** @deprecated kept for the existing internal "cancel" action - use updateSaleStatus directly for new code. */
export async function cancelSale(id: string, actorId: string) {
  return updateSaleStatus(id, 'CANCELLED', actorId);
}

export async function listSales(query: {
  page?: number;
  limit?: number;
  status?: SaleStatus;
  warehouseId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.SaleWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.dateFrom || query.dateTo
      ? { createdAt: { ...(query.dateFrom ? { gte: query.dateFrom } : {}), ...(query.dateTo ? { lte: query.dateTo } : {}) } }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.sale.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: saleInclude }),
    prisma.sale.count({ where }),
  ]);
  return { data, meta: buildMeta(total, page, limit) };
}

export async function getSaleById(id: string) {
  const sale = await prisma.sale.findUnique({ where: { id }, include: saleInclude });
  if (!sale) throw AppError.notFound('Sale not found');
  return sale;
}

export async function listOrdersForCustomer(customerId: string, query: { page?: number; limit?: number; status?: SaleStatus }) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.SaleWhereInput = { customerId, ...(query.status ? { status: query.status } : {}) };
  const [data, total] = await Promise.all([
    prisma.sale.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: saleInclude }),
    prisma.sale.count({ where }),
  ]);
  return { data, meta: buildMeta(total, page, limit) };
}

export async function getOrderForCustomer(id: string, customerId: string) {
  const sale = await prisma.sale.findUnique({ where: { id }, include: saleInclude });
  if (!sale || sale.customerId !== customerId) throw AppError.notFound('Order not found');
  return sale;
}

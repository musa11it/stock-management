import { prisma } from '../config/database';
import { applyStockMovement } from './inventory.service';
import { writeAuditLog } from './auditLog.service';
import { resolvePagination, buildMeta } from '../utils/pagination';
import { Prisma, StockMovementType } from '@prisma/client';
import { AppError } from '../errors/AppError';

export interface AdjustStockInput {
  productId: string;
  warehouseId: string;
  type: 'INCREASE' | 'DECREASE';
  quantity: number;
  reason: string;
  notes?: string;
  userId: string;
}

export async function adjustStock(input: AdjustStockInput) {
  return prisma.$transaction(async (tx) => {
    const signed = input.type === 'INCREASE' ? input.quantity : -input.quantity;

    const { movement, inventory } = await applyStockMovement(tx, {
      productId: input.productId,
      warehouseId: input.warehouseId,
      type: 'ADJUSTMENT',
      signedQuantity: signed,
      reason: input.reason,
      createdById: input.userId,
    });

    const adjustment = await tx.stockAdjustment.create({
      data: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason,
        notes: input.notes,
        createdById: input.userId,
      },
    });

    await writeAuditLog(
      {
        userId: input.userId,
        action: 'STOCK_ADJUSTED',
        entity: 'StockAdjustment',
        entityId: adjustment.id,
        newValue: { productId: input.productId, type: input.type, quantity: input.quantity, reason: input.reason },
      },
      tx,
    );

    return { adjustment, movement, inventory };
  });
}

export interface ConsumeStockInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  reason?: string;
  userId: string;
}

export async function consumeStock(input: ConsumeStockInput) {
  return prisma.$transaction(async (tx) => {
    const { movement, inventory } = await applyStockMovement(tx, {
      productId: input.productId,
      warehouseId: input.warehouseId,
      type: 'CONSUMPTION',
      signedQuantity: -input.quantity,
      reason: input.reason ?? 'Restaurant consumption',
      createdById: input.userId,
      referenceType: 'CONSUMPTION',
    });

    await writeAuditLog(
      {
        userId: input.userId,
        action: 'STOCK_CONSUMED',
        entity: 'StockMovement',
        entityId: movement.id,
        newValue: { productId: input.productId, quantity: input.quantity },
      },
      tx,
    );

    return { movement, inventory };
  });
}

export interface TransferStockInput {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  notes?: string;
  userId: string;
}

export async function transferStock(input: TransferStockInput) {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw AppError.badRequest('Source and destination warehouses must be different', 'SAME_WAREHOUSE');
  }

  return prisma.$transaction(async (tx) => {
    // Carry the source warehouse's existing cost basis across, so the destination's average
    // cost (and therefore its inventory value) is correct immediately, not stuck at 0.
    const sourceInventory = await tx.inventory.findUnique({
      where: { productId_warehouseId: { productId: input.productId, warehouseId: input.fromWarehouseId } },
    });
    const unitCost = sourceInventory?.averageCost.toNumber();

    const out = await applyStockMovement(tx, {
      productId: input.productId,
      warehouseId: input.fromWarehouseId,
      type: 'TRANSFER_OUT',
      signedQuantity: -input.quantity,
      unitCost,
      reason: input.notes ?? `Transfer to warehouse ${input.toWarehouseId}`,
      createdById: input.userId,
      referenceType: 'TRANSFER',
    });

    const inMove = await applyStockMovement(tx, {
      productId: input.productId,
      warehouseId: input.toWarehouseId,
      type: 'TRANSFER_IN',
      signedQuantity: input.quantity,
      unitCost,
      reason: input.notes ?? `Transfer from warehouse ${input.fromWarehouseId}`,
      createdById: input.userId,
      referenceType: 'TRANSFER',
      referenceId: out.movement.id,
    });

    await writeAuditLog(
      {
        userId: input.userId,
        action: 'STOCK_TRANSFERRED',
        entity: 'StockMovement',
        entityId: inMove.movement.id,
        newValue: input,
      },
      tx,
    );

    return { out, in: inMove };
  });
}

export async function listStockMovements(query: {
  page?: number;
  limit?: number;
  productId?: string;
  warehouseId?: string;
  type?: StockMovementType;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.StockMovementWhereInput = {
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { product: { include: { unit: true } }, warehouse: true, createdBy: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return { data, meta: buildMeta(total, page, limit) };
}

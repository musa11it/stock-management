import { Prisma, WastageStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { resolvePagination, buildMeta } from '../utils/pagination';
import { writeAuditLog } from './auditLog.service';
import { applyStockMovement } from './inventory.service';
import { generateDocNumber } from '../utils/docNumber';

const wastageInclude = {
  warehouse: true,
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
  items: { include: { product: { include: { unit: true } } } },
} satisfies Prisma.WastageInclude;

export interface WastageItemInput {
  productId: string;
  quantity: number;
}

export interface CreateWastageInput {
  warehouseId: string;
  reason: 'EXPIRED' | 'DAMAGED' | 'SPOILED' | 'BURNED' | 'SPILLED' | 'OTHER';
  description?: string;
  items: WastageItemInput[];
}

/** MANAGER and SUPER_ADMIN wastage reports are auto-approved and deduct stock immediately. STAFF reports require approval. */
async function deductWastageStock(
  tx: Prisma.TransactionClient,
  wastageId: string,
  warehouseId: string,
  items: { productId: string; quantity: Prisma.Decimal | number }[],
  actorId: string,
) {
  for (const item of items) {
    const product = await tx.product.findUnique({ where: { id: item.productId }, select: { costPrice: true } });
    await applyStockMovement(tx, {
      productId: item.productId,
      warehouseId,
      type: 'WASTAGE',
      signedQuantity: -Number(item.quantity),
      unitCost: product?.costPrice.toNumber(),
      referenceType: 'WASTAGE',
      referenceId: wastageId,
      reason: 'Wastage approved',
      createdById: actorId,
    });
  }
}

export async function createWastage(input: CreateWastageInput, actorId: string, actorRole: string) {
  const autoApprove = actorRole === 'SUPER_ADMIN' || actorRole === 'MANAGER';

  return prisma.$transaction(async (tx) => {
    const wastage = await tx.wastage.create({
      data: {
        wastageNumber: generateDocNumber('WST'),
        warehouseId: input.warehouseId,
        reason: input.reason,
        description: input.description,
        status: autoApprove ? 'APPROVED' : 'PENDING',
        createdById: actorId,
        approvedById: autoApprove ? actorId : null,
        approvedAt: autoApprove ? new Date() : null,
        items: {
          create: input.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        },
      },
      include: wastageInclude,
    });

    if (autoApprove) {
      await deductWastageStock(tx, wastage.id, input.warehouseId, wastage.items, actorId);
    }

    await writeAuditLog(
      { userId: actorId, action: 'WASTAGE_CREATED', entity: 'Wastage', entityId: wastage.id, newValue: wastage },
      tx,
    );

    return wastage;
  });
}

export async function reviewWastage(id: string, approve: boolean, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const wastage = await tx.wastage.findUnique({ where: { id }, include: wastageInclude });
    if (!wastage) throw AppError.notFound('Wastage report not found');
    if (wastage.status !== 'PENDING') {
      throw AppError.conflict('This wastage report has already been reviewed', 'ALREADY_REVIEWED');
    }

    const status: WastageStatus = approve ? 'APPROVED' : 'REJECTED';
    const updated = await tx.wastage.update({
      where: { id },
      data: { status, approvedById: actorId, approvedAt: new Date() },
      include: wastageInclude,
    });

    if (approve) {
      await deductWastageStock(tx, wastage.id, wastage.warehouseId, wastage.items, actorId);
    }

    await writeAuditLog(
      { userId: actorId, action: 'WASTAGE_APPROVED', entity: 'Wastage', entityId: id, newValue: { status } },
      tx,
    );

    return updated;
  });
}

export async function listWastage(query: { page?: number; limit?: number; status?: WastageStatus; warehouseId?: string }) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.WastageWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.wastage.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: wastageInclude }),
    prisma.wastage.count({ where }),
  ]);
  return { data, meta: buildMeta(total, page, limit) };
}

export async function getWastageById(id: string) {
  const wastage = await prisma.wastage.findUnique({ where: { id }, include: wastageInclude });
  if (!wastage) throw AppError.notFound('Wastage report not found');
  return wastage;
}

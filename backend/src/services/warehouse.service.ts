import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { resolvePagination, buildMeta } from '../utils/pagination';
import { writeAuditLog } from './auditLog.service';

export async function listWarehouses(query: { page?: number; limit?: number; search?: string }) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.WarehouseWhereInput = query.search
    ? { name: { contains: query.search, mode: 'insensitive' } }
    : {};
  const [data, total] = await Promise.all([
    prisma.warehouse.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.warehouse.count({ where }),
  ]);
  return { data, meta: buildMeta(total, page, limit) };
}

export async function getWarehouseById(id: string) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id } });
  if (!warehouse) throw AppError.notFound('Warehouse not found');
  return warehouse;
}

const FINISHED_GOODS_WAREHOUSE_NAME = 'Finished Goods Store';

/**
 * The single "sales floor" warehouse for the whole business: Sales/Orders always fulfill from
 * here (they don't pick one themselves - see sale.service.ts createSale/createCustomerOrder),
 * and it's also where a Production run sends its completed output by default (see
 * production.service.ts createProduction), so the user isn't asked to pick a destination every
 * single time. One warehouse, one name, found-or-created on first use so this works whether or
 * not the seed script has (re-)provisioned it for this deployment - reuses the existing
 * Warehouse model/table, not a second location system.
 *
 * A product that's purchased/received directly (not produced) still has to actually be stocked
 * here to be sellable - same Stock Transfer/Purchase-destination choice as any other warehouse,
 * nothing sale-specific about it.
 */
export async function getFinishedGoodsWarehouseId(client: Prisma.TransactionClient | typeof prisma = prisma): Promise<string> {
  const existing = await client.warehouse.findFirst({ where: { name: FINISHED_GOODS_WAREHOUSE_NAME } });
  if (!existing) {
    const created = await client.warehouse.create({ data: { name: FINISHED_GOODS_WAREHOUSE_NAME } });
    return created.id;
  }
  if (!existing.isActive) {
    const reactivated = await client.warehouse.update({ where: { id: existing.id }, data: { isActive: true } });
    return reactivated.id;
  }
  return existing.id;
}

export async function createWarehouse(input: { name: string; location?: string }, actorId: string) {
  const warehouse = await prisma.warehouse.create({ data: input });
  await writeAuditLog({ userId: actorId, action: 'WAREHOUSE_CREATED', entity: 'Warehouse', entityId: warehouse.id, newValue: warehouse });
  return warehouse;
}

export async function updateWarehouse(id: string, input: { name?: string; location?: string; isActive?: boolean }, actorId: string) {
  const existing = await getWarehouseById(id);
  const warehouse = await prisma.warehouse.update({ where: { id }, data: input });
  await writeAuditLog({ userId: actorId, action: 'WAREHOUSE_UPDATED', entity: 'Warehouse', entityId: id, oldValue: existing, newValue: warehouse });
  return warehouse;
}

export async function deleteWarehouse(id: string, actorId: string) {
  const existing = await getWarehouseById(id);
  await prisma.warehouse.update({ where: { id }, data: { isActive: false } });
  await writeAuditLog({ userId: actorId, action: 'WAREHOUSE_DELETED', entity: 'Warehouse', entityId: id, oldValue: existing });
}

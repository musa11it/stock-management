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

/** The warehouse customer orders are fulfilled from - they don't pick one themselves. */
export async function getDefaultWarehouseId(client: Prisma.TransactionClient | typeof prisma = prisma): Promise<string> {
  const warehouse = await client.warehouse.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  if (!warehouse) throw AppError.internal('No active warehouse is configured to fulfill orders from', 'NO_WAREHOUSE_CONFIGURED');
  return warehouse.id;
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

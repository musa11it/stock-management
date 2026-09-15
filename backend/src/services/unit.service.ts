import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { resolvePagination, buildMeta } from '../utils/pagination';
import { writeAuditLog } from './auditLog.service';

export async function listUnits(query: { page?: number; limit?: number; search?: string }) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.UnitWhereInput = query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {};
  const [data, total] = await Promise.all([
    prisma.unit.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.unit.count({ where }),
  ]);
  return { data, meta: buildMeta(total, page, limit) };
}

export async function getUnitById(id: string) {
  const unit = await prisma.unit.findUnique({ where: { id } });
  if (!unit) throw AppError.notFound('Unit not found');
  return unit;
}

export async function createUnit(input: { name: string; abbreviation: string }, actorId: string) {
  const unit = await prisma.unit.create({ data: input });
  await writeAuditLog({ userId: actorId, action: 'UNIT_CREATED', entity: 'Unit', entityId: unit.id, newValue: unit });
  return unit;
}

export async function updateUnit(id: string, input: { name?: string; abbreviation?: string }, actorId: string) {
  const existing = await getUnitById(id);
  const unit = await prisma.unit.update({ where: { id }, data: input });
  await writeAuditLog({ userId: actorId, action: 'UNIT_UPDATED', entity: 'Unit', entityId: id, oldValue: existing, newValue: unit });
  return unit;
}

export async function deleteUnit(id: string, actorId: string) {
  const existing = await getUnitById(id);
  const productCount = await prisma.product.count({ where: { unitId: id } });
  if (productCount > 0) {
    throw AppError.conflict('Cannot delete a unit that is still used by products');
  }
  await prisma.unit.delete({ where: { id } });
  await writeAuditLog({ userId: actorId, action: 'UNIT_DELETED', entity: 'Unit', entityId: id, oldValue: existing });
}

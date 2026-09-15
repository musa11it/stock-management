import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { resolvePagination, buildMeta } from '../utils/pagination';
import { writeAuditLog } from './auditLog.service';

export async function listSuppliers(query: { page?: number; limit?: number; search?: string }) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.SupplierWhereInput = query.search
    ? { name: { contains: query.search, mode: 'insensitive' } }
    : {};
  const [data, total] = await Promise.all([
    prisma.supplier.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.supplier.count({ where }),
  ]);
  return { data, meta: buildMeta(total, page, limit) };
}

export async function getSupplierById(id: string) {
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) throw AppError.notFound('Supplier not found');
  return supplier;
}

export async function createSupplier(
  input: { name: string; contactPerson?: string; email?: string; phone?: string; address?: string },
  actorId: string,
) {
  const supplier = await prisma.supplier.create({ data: input });
  await writeAuditLog({ userId: actorId, action: 'SUPPLIER_CREATED', entity: 'Supplier', entityId: supplier.id, newValue: supplier });
  return supplier;
}

export async function updateSupplier(
  id: string,
  input: { name?: string; contactPerson?: string; email?: string; phone?: string; address?: string; isActive?: boolean },
  actorId: string,
) {
  const existing = await getSupplierById(id);
  const supplier = await prisma.supplier.update({ where: { id }, data: input });
  await writeAuditLog({ userId: actorId, action: 'SUPPLIER_UPDATED', entity: 'Supplier', entityId: id, oldValue: existing, newValue: supplier });
  return supplier;
}

export async function deleteSupplier(id: string, actorId: string) {
  const existing = await getSupplierById(id);
  const purchaseCount = await prisma.purchase.count({ where: { supplierId: id } });
  if (purchaseCount > 0) {
    await prisma.supplier.update({ where: { id }, data: { isActive: false } });
  } else {
    await prisma.supplier.delete({ where: { id } });
  }
  await writeAuditLog({ userId: actorId, action: 'SUPPLIER_DELETED', entity: 'Supplier', entityId: id, oldValue: existing });
}

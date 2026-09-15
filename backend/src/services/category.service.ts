import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { resolvePagination, buildMeta } from '../utils/pagination';
import { writeAuditLog } from './auditLog.service';

export async function listCategories(query: { page?: number; limit?: number; search?: string }) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.CategoryWhereInput = query.search
    ? { name: { contains: query.search, mode: 'insensitive' } }
    : {};

  const [data, total] = await Promise.all([
    prisma.category.findMany({ where, skip, take, orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } }),
    prisma.category.count({ where }),
  ]);
  return { data, meta: buildMeta(total, page, limit) };
}

export async function getCategoryById(id: string) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw AppError.notFound('Category not found');
  return category;
}

export async function createCategory(input: { name: string; description?: string }, actorId: string) {
  const category = await prisma.category.create({ data: input });
  await writeAuditLog({ userId: actorId, action: 'CATEGORY_CREATED', entity: 'Category', entityId: category.id, newValue: category });
  return category;
}

export async function updateCategory(id: string, input: { name?: string; description?: string; isActive?: boolean }, actorId: string) {
  const existing = await getCategoryById(id);
  const category = await prisma.category.update({ where: { id }, data: input });
  await writeAuditLog({ userId: actorId, action: 'CATEGORY_UPDATED', entity: 'Category', entityId: id, oldValue: existing, newValue: category });
  return category;
}

export async function deleteCategory(id: string, actorId: string) {
  const existing = await getCategoryById(id);
  const productCount = await prisma.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    throw AppError.conflict('Cannot delete a category that still has products assigned to it');
  }
  await prisma.category.delete({ where: { id } });
  await writeAuditLog({ userId: actorId, action: 'CATEGORY_DELETED', entity: 'Category', entityId: id, oldValue: existing });
}

import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { resolvePagination, buildMeta } from '../utils/pagination';
import { writeAuditLog } from './auditLog.service';

export async function listMenuItems(query: { page?: number; limit?: number; search?: string; isActive?: boolean }) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.MenuItemWhereInput = {
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.menuItem.findMany({ where, skip, take, orderBy: { name: 'asc' }, include: { recipe: { include: { ingredients: true } } } }),
    prisma.menuItem.count({ where }),
  ]);
  return { data, meta: buildMeta(total, page, limit) };
}

/**
 * Public, unauthenticated menu listing. Shows what each dish is made of (name + quantity + unit
 * only) so customers can see the composition - deliberately excludes product IDs and cost data,
 * which are internal.
 */
export async function listPublicMenuItems(query: { search?: string }) {
  return prisma.menuItem.findMany({
    where: {
      isActive: true,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      category: true,
      imageUrl: true,
      recipe: {
        select: {
          ingredients: {
            select: {
              quantity: true,
              product: { select: { name: true, unit: { select: { abbreviation: true } } } },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getMenuItemById(id: string) {
  const item = await prisma.menuItem.findUnique({
    where: { id },
    include: { recipe: { include: { ingredients: { include: { product: { include: { unit: true } } } } } } },
  });
  if (!item) throw AppError.notFound('Menu item not found');
  return item;
}

export async function createMenuItem(
  input: { name: string; description?: string; price: number; category?: string; imageUrl?: string },
  actorId: string,
) {
  const item = await prisma.menuItem.create({ data: input });
  await writeAuditLog({ userId: actorId, action: 'MENU_ITEM_CREATED', entity: 'MenuItem', entityId: item.id, newValue: item });
  return item;
}

export async function updateMenuItem(
  id: string,
  input: Partial<{ name: string; description: string; price: number; category: string; imageUrl: string; isActive: boolean }>,
  actorId: string,
) {
  const existing = await getMenuItemById(id);
  const item = await prisma.menuItem.update({ where: { id }, data: input });
  await writeAuditLog({ userId: actorId, action: 'MENU_ITEM_UPDATED', entity: 'MenuItem', entityId: id, oldValue: existing, newValue: item });
  return item;
}

export async function deleteMenuItem(id: string, actorId: string) {
  const existing = await getMenuItemById(id);
  const saleCount = await prisma.saleItem.count({ where: { menuItemId: id } });
  if (saleCount > 0) {
    const item = await prisma.menuItem.update({ where: { id }, data: { isActive: false } });
    await writeAuditLog({ userId: actorId, action: 'MENU_ITEM_DELETED', entity: 'MenuItem', entityId: id, oldValue: existing, newValue: item });
    return;
  }
  await prisma.menuItem.delete({ where: { id } });
  await writeAuditLog({ userId: actorId, action: 'MENU_ITEM_DELETED', entity: 'MenuItem', entityId: id, oldValue: existing });
}

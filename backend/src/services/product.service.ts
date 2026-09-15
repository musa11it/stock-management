import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { resolvePagination, buildMeta } from '../utils/pagination';
import { writeAuditLog } from './auditLog.service';
import { generateSku } from '../utils/docNumber';

const productInclude = {
  category: true,
  unit: true,
} satisfies Prisma.ProductInclude;

export async function listProducts(query: {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  lowStock?: boolean;
}) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.ProductWhereInput = {
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { sku: { contains: query.search, mode: 'insensitive' } },
            { barcode: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
      include: { ...productInclude, inventories: true },
    }),
    prisma.product.count({ where }),
  ]);

  let data = rows;
  if (query.lowStock) {
    data = rows.filter((p) => {
      const totalQty = p.inventories.reduce((sum, inv) => sum.add(inv.quantity), new Prisma.Decimal(0));
      return totalQty.lessThanOrEqualTo(p.minimumStock);
    });
  }

  return { data, meta: buildMeta(total, page, limit) };
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, include: { ...productInclude, inventories: { include: { warehouse: true } } } });
  if (!product) throw AppError.notFound('Product not found');
  return product;
}

export async function createProduct(
  input: {
    name: string;
    sku?: string;
    barcode?: string;
    description?: string;
    categoryId: string;
    unitId: string;
    minimumStock?: number;
    maximumStock?: number;
    costPrice?: number;
    sellingPrice?: number;
    isPerishable?: boolean;
    shelfLifeDays?: number;
  },
  actorId: string,
) {
  const [category, unit] = await Promise.all([
    prisma.category.findUnique({ where: { id: input.categoryId } }),
    prisma.unit.findUnique({ where: { id: input.unitId } }),
  ]);
  if (!category) throw AppError.badRequest('Category not found', 'INVALID_CATEGORY');
  if (!unit) throw AppError.badRequest('Unit not found', 'INVALID_UNIT');

  if (input.sku) {
    const existing = await prisma.product.findUnique({ where: { sku: input.sku } });
    if (existing) throw AppError.conflict('A product with this SKU already exists', 'SKU_TAKEN');
  }

  // No SKU given - generate one. Retried in the (astronomically unlikely) case of a collision.
  let sku = input.sku;
  for (let attempt = 0; !sku && attempt < 5; attempt += 1) {
    const candidate = generateSku(input.name);
    const collision = await prisma.product.findUnique({ where: { sku: candidate } });
    if (!collision) sku = candidate;
  }
  if (!sku) throw AppError.internal('Could not generate a unique SKU, please provide one');

  // barcode is optional-and-unique: store a blank one as NULL (which the DB allows to repeat),
  // never as "" (which the unique constraint treats as one real, collidable value).
  const barcode = input.barcode ? input.barcode : undefined;

  const product = await prisma.product.create({ data: { ...input, sku, barcode }, include: productInclude });
  await writeAuditLog({ userId: actorId, action: 'PRODUCT_CREATED', entity: 'Product', entityId: product.id, newValue: product });
  return product;
}

export async function updateProduct(
  id: string,
  input: Partial<{
    name: string;
    sku: string;
    barcode: string | null;
    description: string;
    categoryId: string;
    unitId: string;
    minimumStock: number;
    maximumStock: number;
    costPrice: number;
    sellingPrice: number;
    isPerishable: boolean;
    shelfLifeDays: number;
    isActive: boolean;
  }>,
  actorId: string,
) {
  const existing = await getProductById(id);
  // barcode is optional-and-unique: an explicitly-cleared "" must become NULL, never stay ""
  // (the DB unique constraint treats "" as one real, collidable value; NULL can repeat freely).
  const data = { ...input, ...(input.barcode !== undefined ? { barcode: input.barcode || null } : {}) };
  const product = await prisma.product.update({ where: { id }, data, include: productInclude });
  await writeAuditLog({ userId: actorId, action: 'PRODUCT_UPDATED', entity: 'Product', entityId: id, oldValue: existing, newValue: product });
  return product;
}

export async function deleteProduct(id: string, actorId: string) {
  const existing = await getProductById(id);
  const movementCount = await prisma.stockMovement.count({ where: { productId: id } });
  if (movementCount > 0) {
    const product = await prisma.product.update({ where: { id }, data: { isActive: false } });
    await writeAuditLog({ userId: actorId, action: 'PRODUCT_DELETED', entity: 'Product', entityId: id, oldValue: existing, newValue: product });
    return;
  }
  await prisma.product.delete({ where: { id } });
  await writeAuditLog({ userId: actorId, action: 'PRODUCT_DELETED', entity: 'Product', entityId: id, oldValue: existing });
}

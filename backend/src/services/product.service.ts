import { Prisma, ProductType } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { resolvePagination, buildMeta } from '../utils/pagination';
import { writeAuditLog } from './auditLog.service';

const productInclude = {
  category: true,
  unit: true,
  // Lightweight - just enough for the Products/Production pages to show "Listed for sale" vs a
  // "List for Sale" action, without a second round-trip.
  directSaleMenuItem: { select: { id: true, name: true, isActive: true } },
} satisfies Prisma.ProductInclude;

export async function listProducts(query: {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  type?: ProductType;
  isActive?: boolean;
  lowStock?: boolean;
}) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.ProductWhereInput = {
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.type ? { type: query.type } : {}),
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

export interface CreateProductInput {
  name: string;
  description?: string;
  categoryId: string;
  unitId: string;
  type?: ProductType;
  minimumStock?: number;
  maximumStock?: number;
  costPrice?: number;
  /** Most ingredients aren't sold directly - leave unset unless this one is (e.g. bottled drinks). */
  sellingPrice?: number;
  isPerishable?: boolean;
  shelfLifeDays?: number;
}

export async function createProduct(input: CreateProductInput, actorId: string) {
  const [category, unit, existing] = await Promise.all([
    prisma.category.findUnique({ where: { id: input.categoryId } }),
    prisma.unit.findUnique({ where: { id: input.unitId } }),
    prisma.product.findUnique({ where: { name: input.name } }),
  ]);
  if (!category) throw AppError.badRequest('Category not found', 'INVALID_CATEGORY');
  if (!unit) throw AppError.badRequest('Unit not found', 'INVALID_UNIT');
  if (existing) throw AppError.conflict('A product with this name already exists', 'NAME_TAKEN');
  // Same rule updateProduct() already enforces - checked here too so a product can never be
  // created in the same invalid state (isPerishable=true with no real shelf life) that would
  // then block every future edit of it.
  if (input.isPerishable && (!input.shelfLifeDays || input.shelfLifeDays <= 0)) {
    throw AppError.badRequest('Shelf life (days) is required for perishable products', 'SHELF_LIFE_REQUIRED');
  }

  // Expiry is derived from shelf life at receiving time, never stored as a fixed date on the
  // product - but shelf life itself only makes sense for perishables, so a non-perishable
  // product never carries one, regardless of what was submitted.
  const data = { ...input, shelfLifeDays: input.isPerishable ? input.shelfLifeDays ?? null : null };

  const product = await prisma.product.create({ data, include: productInclude });
  await writeAuditLog({ userId: actorId, action: 'PRODUCT_CREATED', entity: 'Product', entityId: product.id, newValue: product });
  return product;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  categoryId?: string;
  unitId?: string;
  type?: ProductType | null;
  minimumStock?: number;
  maximumStock?: number;
  costPrice?: number;
  sellingPrice?: number | null;
  isPerishable?: boolean;
  shelfLifeDays?: number | null;
  isActive?: boolean;
}

export async function updateProduct(id: string, input: UpdateProductInput, actorId: string) {
  const existing = await getProductById(id);

  if (input.name && input.name !== existing.name) {
    const nameTaken = await prisma.product.findUnique({ where: { name: input.name } });
    if (nameTaken) throw AppError.conflict('A product with this name already exists', 'NAME_TAKEN');
  }

  // Validate against the *merged* state (existing + this update) since a PATCH may only touch
  // one of the two coupled fields.
  const effectiveIsPerishable = input.isPerishable ?? existing.isPerishable;
  let shelfLifeDays = input.shelfLifeDays;
  if (effectiveIsPerishable) {
    const effectiveShelfLife = shelfLifeDays !== undefined ? shelfLifeDays : existing.shelfLifeDays;
    if (!effectiveShelfLife || effectiveShelfLife <= 0) {
      throw AppError.badRequest('Shelf life (days) is required for perishable products', 'SHELF_LIFE_REQUIRED');
    }
  } else {
    shelfLifeDays = null; // turning off (or already off) perishable clears any shelf life
  }

  const product = await prisma.product.update({ where: { id }, data: { ...input, shelfLifeDays }, include: productInclude });
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

import crypto from 'crypto';
import { PrismaClient, RoleName, ProductType } from '@prisma/client';
import { hashPassword } from '../utils/password';
import { getFinishedGoodsWarehouseId } from '../services/warehouse.service';

export const prisma = new PrismaClient();

let counter = 0;

/** High-entropy suffix: safe to truncate from either end without colliding across test files in the same run. */
export function uniqueSuffix(): string {
  counter += 1;
  return `${counter}${crypto.randomBytes(4).toString('hex')}`;
}

export async function ensureRole(name: RoleName) {
  return prisma.role.upsert({ where: { name }, update: {}, create: { name } });
}

export async function createTestUser(roleName: RoleName, emailPrefix = 'test-user') {
  const role = await ensureRole(roleName);
  const suffix = uniqueSuffix();
  return prisma.user.create({
    data: {
      firstName: 'Test',
      lastName: roleName,
      email: `${emailPrefix}-${suffix}@example.com`,
      passwordHash: await hashPassword('Password@123'),
      roleId: role.id,
      status: 'ACTIVE',
    },
  });
}

export async function createTestCategory() {
  const suffix = uniqueSuffix();
  return prisma.category.create({ data: { name: `Test Category ${suffix}` } });
}

export async function createTestUnit() {
  const suffix = uniqueSuffix();
  return prisma.unit.create({ data: { name: `Test Unit ${suffix}`, abbreviation: `TU${suffix}`.slice(0, 10) } });
}

export async function createTestWarehouse() {
  const suffix = uniqueSuffix();
  return prisma.warehouse.create({ data: { name: `Test Warehouse ${suffix}` } });
}

/**
 * getDefaultWarehouseId() (what Sale/Order fulfillment always resolves to - see
 * warehouse.service.ts) now always means "Finished Goods Store", not "the oldest warehouse".
 * Tests that need to land stock somewhere createSale()/createCustomerOrder() will actually see
 * must fetch this shared, real warehouse row rather than create their own - Warehouse.name is
 * unique, so a second "Finished Goods Store" row would collide, and the whole point is that
 * there is exactly one.
 *
 * IMPORTANT: never delete this warehouse row in a test's afterAll (other test files, and the
 * app itself, depend on it continuing to exist) - only clean up the product-scoped
 * inventory/batch/movement rows a test created inside it.
 */
export async function getTestSalesWarehouseId(): Promise<string> {
  return getFinishedGoodsWarehouseId(prisma);
}

export async function createTestProduct(overrides: {
  categoryId: string;
  unitId: string;
  minimumStock?: number;
  costPrice?: number;
  isPerishable?: boolean;
  shelfLifeDays?: number;
  /** Left unset by default (null), matching a pre-classification product - see schema.prisma. */
  type?: ProductType;
}) {
  const suffix = uniqueSuffix();
  return prisma.product.create({
    data: {
      name: `Test Product ${suffix}`,
      categoryId: overrides.categoryId,
      unitId: overrides.unitId,
      minimumStock: overrides.minimumStock ?? 10,
      costPrice: overrides.costPrice ?? 100,
      isPerishable: overrides.isPerishable ?? false,
      shelfLifeDays: overrides.shelfLifeDays,
      type: overrides.type,
    },
  });
}

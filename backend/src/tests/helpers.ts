import crypto from 'crypto';
import { PrismaClient, RoleName } from '@prisma/client';
import { hashPassword } from '../utils/password';

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

export async function createTestProduct(overrides: { categoryId: string; unitId: string; minimumStock?: number; costPrice?: number }) {
  const suffix = uniqueSuffix();
  return prisma.product.create({
    data: {
      name: `Test Product ${suffix}`,
      sku: `SKU-${suffix}`,
      categoryId: overrides.categoryId,
      unitId: overrides.unitId,
      minimumStock: overrides.minimumStock ?? 10,
      costPrice: overrides.costPrice ?? 100,
      sellingPrice: 0,
    },
  });
}

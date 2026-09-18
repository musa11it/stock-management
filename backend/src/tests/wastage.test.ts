import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, createTestUser, createTestCategory, createTestUnit, createTestWarehouse, createTestProduct } from './helpers';
import { adjustStock } from '../services/stock.service';
import { createWastage, reviewWastage } from '../services/wastage.service';

describe('wastage approval workflow', () => {
  let staffId: string;
  let managerId: string;
  let productId: string;
  let warehouseId: string;
  let categoryId: string;
  let unitId: string;

  beforeAll(async () => {
    const staff = await createTestUser('STAFF');
    const manager = await createTestUser('MANAGER');
    const category = await createTestCategory();
    const unit = await createTestUnit();
    const warehouse = await createTestWarehouse();
    const product = await createTestProduct({ categoryId: category.id, unitId: unit.id });

    staffId = staff.id;
    managerId = manager.id;
    productId = product.id;
    warehouseId = warehouse.id;
    categoryId = category.id;
    unitId = unit.id;

    await adjustStock({ productId, warehouseId, type: 'INCREASE', quantity: 100, reason: 'seed', userId: managerId });
  });

  afterAll(async () => {
    if (!productId) {
      await prisma.$disconnect();
      return;
    }
    await prisma.stockMovement.deleteMany({ where: { productId } });
    await prisma.stockAdjustment.deleteMany({ where: { productId } });
    await prisma.wastageItem.deleteMany({ where: { product: { id: productId } } });
    await prisma.wastage.deleteMany({ where: { createdById: { in: [staffId, managerId].filter(Boolean) } } });
    await prisma.inventoryBatch.deleteMany({ where: { productId } });
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.unit.deleteMany({ where: { id: unitId } });
    await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
    await prisma.user.deleteMany({ where: { id: { in: [staffId, managerId] } } });
    await prisma.$disconnect();
  });

  it('does NOT deduct stock when a staff member reports wastage (pending approval)', async () => {
    const wastage = await createWastage(
      { warehouseId, reason: 'SPOILED', items: [{ productId, quantity: 10 }] },
      staffId,
      'STAFF',
    );
    expect(wastage.status).toBe('PENDING');

    const inventory = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId, warehouseId } } });
    expect(inventory!.quantity.toNumber()).toBe(100);

    const approved = await reviewWastage(wastage.id, true, managerId);
    expect(approved.status).toBe('APPROVED');

    const inventoryAfter = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId, warehouseId } } });
    expect(inventoryAfter!.quantity.toNumber()).toBe(90);
  });

  it('auto-approves and immediately deducts stock when reported by a manager', async () => {
    const wastage = await createWastage(
      { warehouseId, reason: 'DAMAGED', items: [{ productId, quantity: 5 }] },
      managerId,
      'MANAGER',
    );
    expect(wastage.status).toBe('APPROVED');

    const inventory = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId, warehouseId } } });
    expect(inventory!.quantity.toNumber()).toBe(85);
  });

  it('does not double-review an already-reviewed wastage report', async () => {
    const wastage = await createWastage(
      { warehouseId, reason: 'OTHER', items: [{ productId, quantity: 1 }] },
      staffId,
      'STAFF',
    );
    await reviewWastage(wastage.id, false, managerId);
    await expect(reviewWastage(wastage.id, true, managerId)).rejects.toThrow(/already been reviewed/i);
  });
});

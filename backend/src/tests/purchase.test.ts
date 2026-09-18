import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, createTestUser, createTestCategory, createTestUnit, createTestWarehouse, createTestProduct, uniqueSuffix } from './helpers';
import { createPurchase, receivePurchase } from '../services/purchase.service';

describe('purchase receiving updates stock atomically', () => {
  let userId: string;
  let productId: string;
  let warehouseId: string;
  let supplierId: string;
  let categoryId: string;
  let unitId: string;
  let purchaseId: string;

  beforeAll(async () => {
    const user = await createTestUser('MANAGER');
    const category = await createTestCategory();
    const unit = await createTestUnit();
    const warehouse = await createTestWarehouse();
    const product = await createTestProduct({ categoryId: category.id, unitId: unit.id });
    const supplier = await prisma.supplier.create({ data: { name: `Test Supplier ${uniqueSuffix()}` } });

    userId = user.id;
    productId = product.id;
    warehouseId = warehouse.id;
    supplierId = supplier.id;
    categoryId = category.id;
    unitId = unit.id;
  });

  afterAll(async () => {
    if (!productId) {
      await prisma.$disconnect();
      return;
    }
    await prisma.stockMovement.deleteMany({ where: { productId } });
    await prisma.purchaseItem.deleteMany({ where: { productId } });
    await prisma.purchase.deleteMany({ where: { supplierId } });
    await prisma.inventoryBatch.deleteMany({ where: { productId } });
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.supplier.deleteMany({ where: { id: supplierId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.unit.deleteMany({ where: { id: unitId } });
    await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('creates a purchase in PENDING status with correct totals', async () => {
    const purchase = await createPurchase(
      { supplierId, warehouseId, items: [{ productId, quantity: 40, unitCost: 900 }], tax: 100, discount: 50 },
      userId,
    );
    purchaseId = purchase.id;

    expect(purchase.status).toBe('PENDING');
    expect(purchase.subtotal.toNumber()).toBe(36000);
    expect(purchase.total.toNumber()).toBe(36050);
  });

  it('partially receiving updates status to PARTIALLY_RECEIVED, increases stock by the received amount only, and bills only for what arrived', async () => {
    const updated = await receivePurchase(purchaseId, { items: [{ productId, receivedQty: 25 }] }, userId);
    expect(updated.status).toBe('PARTIALLY_RECEIVED');

    const inventory = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId, warehouseId } } });
    expect(inventory!.quantity.toNumber()).toBe(25);

    const item = updated.items.find((i) => i.productId === productId)!;
    expect(item.receivedQty.toNumber()).toBe(25);

    // 25 received @ 900 = 22500, plus the original flat tax/discount (100 / 50) - not the full order's 36000.
    expect(updated.subtotal.toNumber()).toBe(22500);
    expect(updated.total.toNumber()).toBe(22550);
  });

  it('receiving the remainder moves status to RECEIVED, stock reflects the full ordered quantity, and the total returns to the full order value', async () => {
    const updated = await receivePurchase(purchaseId, {}, userId);
    expect(updated.status).toBe('RECEIVED');
    expect(updated.receivedAt).not.toBeNull();

    const inventory = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId, warehouseId } } });
    expect(inventory!.quantity.toNumber()).toBe(40);

    const movements = await prisma.stockMovement.findMany({ where: { productId, type: 'PURCHASE' } });
    expect(movements).toHaveLength(2);
    expect(movements.reduce((sum, m) => sum + m.quantity.toNumber(), 0)).toBe(40);

    expect(updated.subtotal.toNumber()).toBe(36000);
    expect(updated.total.toNumber()).toBe(36050);
  });

  it('rejects receiving an already fully-received purchase', async () => {
    await expect(receivePurchase(purchaseId, {}, userId)).rejects.toThrow(/already been fully received/i);
  });
});

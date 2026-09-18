import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, createTestUser, createTestCategory, createTestUnit, createTestWarehouse, createTestProduct, uniqueSuffix } from './helpers';
import { createPurchase } from '../services/purchase.service';
import { adjustStock, consumeStock, transferStock } from '../services/stock.service';
import { createWastage } from '../services/wastage.service';

describe('product-warehouse assignment enforcement', () => {
  let userId: string;
  let categoryId: string;
  let unitId: string;
  let warehouseAId: string;
  let warehouseBId: string;
  let productId: string; // will be assigned to warehouse A only
  let freshProductId: string; // never assigned anywhere - used for the INCREASE bootstrap case
  let freshProduct2Id: string; // never assigned anywhere - used for the purchase bootstrap case
  let supplierId: string;

  beforeAll(async () => {
    const user = await createTestUser('MANAGER'); // auto-approves wastage
    const category = await createTestCategory();
    const unit = await createTestUnit();
    const warehouseA = await createTestWarehouse();
    const warehouseB = await createTestWarehouse();
    const product = await createTestProduct({ categoryId: category.id, unitId: unit.id });
    const freshProduct = await createTestProduct({ categoryId: category.id, unitId: unit.id });
    const freshProduct2 = await createTestProduct({ categoryId: category.id, unitId: unit.id });
    const supplier = await prisma.supplier.create({ data: { name: `Test Supplier ${uniqueSuffix()}` } });

    userId = user.id;
    categoryId = category.id;
    unitId = unit.id;
    warehouseAId = warehouseA.id;
    warehouseBId = warehouseB.id;
    productId = product.id;
    freshProductId = freshProduct.id;
    freshProduct2Id = freshProduct2.id;
    supplierId = supplier.id;

    // Assign `product` to warehouse A only.
    await adjustStock({ productId, warehouseId: warehouseAId, type: 'INCREASE', quantity: 10, reason: 'seed', userId });
  });

  afterAll(async () => {
    if (!productId) {
      await prisma.$disconnect();
      return;
    }
    const productIds = [productId, freshProductId, freshProduct2Id];
    await prisma.wastageItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.wastage.deleteMany({ where: { warehouseId: { in: [warehouseAId, warehouseBId] } } });
    await prisma.purchaseItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.purchase.deleteMany({ where: { supplierId } });
    await prisma.stockAdjustment.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.inventoryBatch.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.supplier.deleteMany({ where: { id: supplierId } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.unit.deleteMany({ where: { id: unitId } });
    await prisma.warehouse.deleteMany({ where: { id: { in: [warehouseAId, warehouseBId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('blocks consuming a product from a warehouse it is not assigned to', async () => {
    await expect(consumeStock({ productId, warehouseId: warehouseBId, quantity: 1, userId })).rejects.toThrow(/not assigned/i);
  });

  it('blocks wasting a product in a warehouse it is not assigned to', async () => {
    await expect(
      createWastage({ warehouseId: warehouseBId, reason: 'DAMAGED', items: [{ productId, quantity: 1 }] }, userId, 'MANAGER'),
    ).rejects.toThrow(/not assigned/i);
  });

  it('blocks a DECREASE adjustment in a warehouse the product is not assigned to', async () => {
    await expect(
      adjustStock({ productId, warehouseId: warehouseBId, type: 'DECREASE', quantity: 1, reason: 'test', userId }),
    ).rejects.toThrow(/not assigned/i);
  });

  it('blocks transferring a product out of a warehouse it is not assigned to', async () => {
    await expect(
      transferStock({ productId, fromWarehouseId: warehouseBId, toWarehouseId: warehouseAId, quantity: 1, userId }),
    ).rejects.toThrow(/not assigned/i);
  });

  it('blocks purchasing a product already assigned to another warehouse into a different one', async () => {
    await expect(
      createPurchase({ supplierId, warehouseId: warehouseBId, items: [{ productId, quantity: 5, unitCost: 10 }] }, userId),
    ).rejects.toThrow(/not assigned/i);
  });

  it("allows an INCREASE adjustment to establish a never-assigned product's first assignment", async () => {
    const { inventory } = await adjustStock({ productId: freshProductId, warehouseId: warehouseBId, type: 'INCREASE', quantity: 3, reason: 'expand', userId });
    expect(inventory.quantity.toNumber()).toBe(3);
  });

  it('allows purchasing a completely new (never-assigned) product into any warehouse', async () => {
    const purchase = await createPurchase(
      { supplierId, warehouseId: warehouseBId, items: [{ productId: freshProduct2Id, quantity: 8, unitCost: 20 }] },
      userId,
    );
    expect(purchase.status).toBe('PENDING');
  });

  it('allows transferring stock into a warehouse the product was not previously assigned to', async () => {
    // productId now has stock in both A and B (from earlier tests) - transfer B -> A should still work fine
    // since A already had the original assignment; verify the reverse direction (A -> a brand new warehouse) instead.
    const warehouseC = await createTestWarehouse();
    const { in: inMove } = await transferStock({ productId, fromWarehouseId: warehouseAId, toWarehouseId: warehouseC.id, quantity: 2, userId });
    expect(inMove.inventory.quantity.toNumber()).toBe(2);

    await prisma.stockMovement.deleteMany({ where: { productId, warehouseId: warehouseC.id } });
    await prisma.inventoryBatch.deleteMany({ where: { productId, warehouseId: warehouseC.id } });
    await prisma.inventory.deleteMany({ where: { productId, warehouseId: warehouseC.id } });
    await prisma.warehouse.deleteMany({ where: { id: warehouseC.id } });
  });
});

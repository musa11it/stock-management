import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, createTestUser, createTestCategory, createTestUnit, createTestProduct, uniqueSuffix, getTestSalesWarehouseId } from './helpers';
import { createPurchase, receivePurchase } from '../services/purchase.service';
import { consumeStock } from '../services/stock.service';
import { createWastage } from '../services/wastage.service';
import { createSale } from '../services/sale.service';

describe('perishable product expiry and FEFO stock consumption', () => {
  let userId: string;
  let warehouseId: string;
  let categoryId: string;
  let unitId: string;
  let perishableId: string;
  let nonPerishableId: string;
  let supplierId: string;
  let menuItemId: string;

  beforeAll(async () => {
    const user = await createTestUser('MANAGER'); // auto-approves wastage
    const category = await createTestCategory();
    const unit = await createTestUnit();
    // createSale() always resolves the shared Finished Goods Store internally rather than taking
    // one as input - use the real one so the later createSale() call in this file can find stock.
    const perishable = await createTestProduct({ categoryId: category.id, unitId: unit.id, isPerishable: true, shelfLifeDays: 5 });
    const nonPerishable = await createTestProduct({ categoryId: category.id, unitId: unit.id });
    const supplier = await prisma.supplier.create({ data: { name: `Test Supplier ${uniqueSuffix()}` } });

    userId = user.id;
    warehouseId = await getTestSalesWarehouseId();
    categoryId = category.id;
    unitId = unit.id;
    perishableId = perishable.id;
    nonPerishableId = nonPerishable.id;
    supplierId = supplier.id;
  });

  afterAll(async () => {
    if (!perishableId) {
      await prisma.$disconnect();
      return;
    }
    // Scoped to this test's own menuItem/products, not the whole (shared) Finished Goods Store
    // warehouse - other test files sell/waste in that same warehouse and must not be touched.
    if (menuItemId) {
      await prisma.sale.deleteMany({ where: { items: { some: { menuItemId } } } });
      await prisma.saleItem.deleteMany({ where: { menuItemId } });
      await prisma.recipe.deleteMany({ where: { menuItemId } });
      await prisma.menuItem.deleteMany({ where: { id: menuItemId } });
    }
    await prisma.recipeIngredient.deleteMany({ where: { productId: { in: [perishableId, nonPerishableId] } } });
    await prisma.wastage.deleteMany({ where: { items: { some: { productId: { in: [perishableId, nonPerishableId] } } } } });
    await prisma.wastageItem.deleteMany({ where: { productId: { in: [perishableId, nonPerishableId] } } });
    await prisma.purchaseItem.deleteMany({ where: { productId: { in: [perishableId, nonPerishableId] } } });
    await prisma.purchase.deleteMany({ where: { supplierId } });
    await prisma.stockMovement.deleteMany({ where: { productId: { in: [perishableId, nonPerishableId] } } });
    await prisma.inventoryBatch.deleteMany({ where: { productId: { in: [perishableId, nonPerishableId] } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: [perishableId, nonPerishableId] } } });
    await prisma.supplier.deleteMany({ where: { id: supplierId } });
    await prisma.product.deleteMany({ where: { id: { in: [perishableId, nonPerishableId] } } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.unit.deleteMany({ where: { id: unitId } });
    // warehouseId is the shared Finished Goods Store now - never delete it.
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('computes Expiry Date = Received Date + Shelf Life when a perishable product is received', async () => {
    const purchase = await createPurchase({ supplierId, warehouseId, items: [{ productId: perishableId, quantity: 10, unitCost: 100 }] }, userId);
    const before = Date.now();
    await receivePurchase(purchase.id, {}, userId);
    const after = Date.now();

    const batch = await prisma.inventoryBatch.findFirst({ where: { productId: perishableId, warehouseId } });
    expect(batch).not.toBeNull();
    expect(batch!.expiryDate).not.toBeNull();

    const expectedMin = before + 5 * 24 * 60 * 60 * 1000;
    const expectedMax = after + 5 * 24 * 60 * 60 * 1000;
    expect(batch!.expiryDate!.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(batch!.expiryDate!.getTime()).toBeLessThanOrEqual(expectedMax);
  });

  it('leaves expiryDate null for a non-perishable product', async () => {
    const purchase = await createPurchase({ supplierId, warehouseId, items: [{ productId: nonPerishableId, quantity: 10, unitCost: 50 }] }, userId);
    await receivePurchase(purchase.id, {}, userId);

    const batch = await prisma.inventoryBatch.findFirst({ where: { productId: nonPerishableId, warehouseId } });
    expect(batch!.expiryDate).toBeNull();
  });

  it('consumes the batch with the nearest expiry date first (FEFO), leaving the later batch untouched', async () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const later = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const soonBatch = await prisma.inventoryBatch.create({
      data: { productId: perishableId, warehouseId, quantity: 4, unitCost: 100, expiryDate: soon, batchNumber: 'SOON' },
    });
    const laterBatch = await prisma.inventoryBatch.create({
      data: { productId: perishableId, warehouseId, quantity: 4, unitCost: 100, expiryDate: later, batchNumber: 'LATER' },
    });
    await prisma.inventory.update({
      where: { productId_warehouseId: { productId: perishableId, warehouseId } },
      data: { quantity: { increment: 8 } },
    });

    await consumeStock({ productId: perishableId, warehouseId, quantity: 3, userId });

    const refreshedSoon = await prisma.inventoryBatch.findUnique({ where: { id: soonBatch.id } });
    const refreshedLater = await prisma.inventoryBatch.findUnique({ where: { id: laterBatch.id } });
    expect(refreshedSoon!.quantity.toNumber()).toBe(1); // 4 - 3, drawn first
    expect(refreshedLater!.quantity.toNumber()).toBe(4); // untouched
  });

  it('blocks a sale that would have to draw from an already-expired batch', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.stockMovement.deleteMany({ where: { productId: perishableId, warehouseId } });
    await prisma.inventoryBatch.deleteMany({ where: { productId: perishableId, warehouseId } });
    await prisma.inventory.update({ where: { productId_warehouseId: { productId: perishableId, warehouseId } }, data: { quantity: 0 } });
    await prisma.inventoryBatch.create({
      data: { productId: perishableId, warehouseId, quantity: 5, unitCost: 100, expiryDate: past, batchNumber: 'EXPIRED' },
    });
    await prisma.inventory.update({ where: { productId_warehouseId: { productId: perishableId, warehouseId } }, data: { quantity: 5 } });

    const menuItem = await prisma.menuItem.create({ data: { name: `Test Expiry Dish ${uniqueSuffix()}`, price: 1000 } });
    menuItemId = menuItem.id;
    await prisma.recipe.create({
      data: { name: `Test Expiry Recipe ${uniqueSuffix()}`, menuItemId, ingredients: { create: [{ productId: perishableId, quantity: 1 }] } },
    });

    await expect(createSale({ items: [{ menuItemId, quantity: 1 }] }, userId)).rejects.toThrow(/expired/i);

    const inventory = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: perishableId, warehouseId } } });
    expect(inventory!.quantity.toNumber()).toBe(5); // untouched - the whole transaction rolled back
  });

  it('still allows wasting expired stock (that is how expired stock gets removed)', async () => {
    const wastage = await createWastage(
      { warehouseId, reason: 'EXPIRED', items: [{ productId: perishableId, quantity: 5 }] },
      userId,
      'MANAGER',
    );
    expect(wastage.status).toBe('APPROVED');

    const inventory = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: perishableId, warehouseId } } });
    expect(inventory!.quantity.toNumber()).toBe(0);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, createTestUser, createTestCategory, createTestUnit, createTestProduct, uniqueSuffix, getTestSalesWarehouseId } from './helpers';
import { adjustStock } from '../services/stock.service';
import { createSale } from '../services/sale.service';

describe('a menu item without a recipe still sells (Model D: no production required)', () => {
  let userId: string;
  let menuItemId: string;

  beforeAll(async () => {
    const user = await createTestUser('MANAGER');
    userId = user.id;
    const menuItem = await prisma.menuItem.create({ data: { name: `Test Consulting Fee ${uniqueSuffix()}`, price: 5000 } });
    menuItemId = menuItem.id;
  });

  afterAll(async () => {
    await prisma.saleItem.deleteMany({ where: { menuItemId } });
    await prisma.sale.deleteMany({ where: { createdById: userId } });
    await prisma.menuItem.deleteMany({ where: { id: menuItemId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('sells without crashing and without requiring or performing any stock consumption', async () => {
    const sale = await createSale({ items: [{ menuItemId, quantity: 2 }] }, userId);
    expect(sale.status).toBe('COMPLETED');
    expect(sale.total.toNumber()).toBe(10000);

    const movements = await prisma.stockMovement.findMany({ where: { referenceType: 'SALE', referenceId: sale.id } });
    expect(movements).toHaveLength(0); // nothing to deduct - no recipe configured
  });
});

describe('Model A: a raw product sold directly, via a menu item wrapping it 1:1', () => {
  let userId: string;
  let warehouseId: string;
  let categoryId: string;
  let unitId: string;
  let waterId: string;
  let menuItemId: string;

  beforeAll(async () => {
    const user = await createTestUser('MANAGER');
    const category = await createTestCategory();
    const unit = await createTestUnit();
    // createSale() always resolves the shared Finished Goods Store internally - use the real one.
    const water = await createTestProduct({ categoryId: category.id, unitId: unit.id, costPrice: 200 });

    userId = user.id;
    categoryId = category.id;
    unitId = unit.id;
    warehouseId = await getTestSalesWarehouseId();
    waterId = water.id;

    await adjustStock({ productId: waterId, warehouseId, type: 'INCREASE', quantity: 24, reason: 'seed', userId });

    const menuItem = await prisma.menuItem.create({ data: { name: `Test Bottled Water ${uniqueSuffix()}`, price: 500 } });
    menuItemId = menuItem.id;
    await prisma.recipe.create({
      data: { name: `Test Bottled Water Recipe ${uniqueSuffix()}`, menuItemId, ingredients: { create: [{ productId: waterId, quantity: 1 }] } },
    });
  });

  afterAll(async () => {
    // Scoped to this test's own menuItemId, not the whole (shared) Finished Goods Store
    // warehouse - other test files sell from that same warehouse and must not be touched.
    await prisma.sale.deleteMany({ where: { items: { some: { menuItemId } } } });
    await prisma.saleItem.deleteMany({ where: { menuItemId } });
    await prisma.recipeIngredient.deleteMany({ where: { productId: waterId } });
    await prisma.recipe.deleteMany({ where: { menuItemId } });
    await prisma.menuItem.deleteMany({ where: { id: menuItemId } });
    await prisma.stockMovement.deleteMany({ where: { productId: waterId } });
    await prisma.stockAdjustment.deleteMany({ where: { productId: waterId } });
    await prisma.inventoryBatch.deleteMany({ where: { productId: waterId } });
    await prisma.inventory.deleteMany({ where: { productId: waterId } });
    await prisma.product.deleteMany({ where: { id: waterId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.unit.deleteMany({ where: { id: unitId } });
    // warehouseId is the shared Finished Goods Store now - never delete it.
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('selling the wrapping menu item deducts exactly 1:1 from the underlying product - no production, no separate sales system', async () => {
    await createSale({ items: [{ menuItemId, quantity: 5 }] }, userId);
    const inv = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: waterId, warehouseId } } });
    expect(inv!.quantity.toNumber()).toBe(19); // 24 - 5
  });
});

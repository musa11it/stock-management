import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, createTestUser, createTestCategory, createTestUnit, createTestProduct, uniqueSuffix, getTestSalesWarehouseId } from './helpers';
import { adjustStock } from '../services/stock.service';
import { createSale, cancelSale } from '../services/sale.service';

describe('sales deduct recipe ingredients accurately', () => {
  let userId: string;
  let warehouseId: string;
  let breadId: string;
  let pattyId: string;
  let menuItemId: string;
  let categoryId: string;
  let unitId: string;

  beforeAll(async () => {
    const user = await createTestUser('STAFF');
    const category = await createTestCategory();
    const unit = await createTestUnit();
    // createSale() no longer takes a warehouseId - it always resolves Finished Goods Store
    // internally, same as a customer order. Use the real shared one, not a private test warehouse.
    const bread = await createTestProduct({ categoryId: category.id, unitId: unit.id });
    const patty = await createTestProduct({ categoryId: category.id, unitId: unit.id });

    userId = user.id;
    warehouseId = await getTestSalesWarehouseId();
    breadId = bread.id;
    pattyId = patty.id;
    categoryId = category.id;
    unitId = unit.id;

    await adjustStock({ productId: breadId, warehouseId, type: 'INCREASE', quantity: 20, reason: 'seed', userId });
    await adjustStock({ productId: pattyId, warehouseId, type: 'INCREASE', quantity: 5, reason: 'seed', userId });

    const menuItem = await prisma.menuItem.create({ data: { name: `Test Burger ${uniqueSuffix()}`, price: 4000 } });
    menuItemId = menuItem.id;
    await prisma.recipe.create({
      data: {
        name: `Test Recipe ${uniqueSuffix()}`,
        menuItemId,
        ingredients: { create: [{ productId: breadId, quantity: 1 }, { productId: pattyId, quantity: 1 }] },
      },
    });
  });

  afterAll(async () => {
    if (!breadId || !pattyId || !menuItemId) {
      await prisma.$disconnect();
      return;
    }
    await prisma.saleItem.deleteMany({ where: { menuItemId } });
    await prisma.sale.deleteMany({ where: { createdById: userId } });
    await prisma.stockMovement.deleteMany({ where: { productId: { in: [breadId, pattyId] } } });
    await prisma.stockAdjustment.deleteMany({ where: { productId: { in: [breadId, pattyId] } } });
    await prisma.recipeIngredient.deleteMany({ where: { productId: { in: [breadId, pattyId] } } });
    await prisma.recipe.deleteMany({ where: { menuItemId } });
    await prisma.menuItem.deleteMany({ where: { id: menuItemId } });
    await prisma.inventoryBatch.deleteMany({ where: { productId: { in: [breadId, pattyId] } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: [breadId, pattyId] } } });
    await prisma.product.deleteMany({ where: { id: { in: [breadId, pattyId] } } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.unit.deleteMany({ where: { id: unitId } });
    // warehouseId is the shared Finished Goods Store now, not a private test warehouse - never delete it.
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('deducts the correct ingredient quantities when a menu item is sold', async () => {
    const sale = await createSale({ items: [{ menuItemId, quantity: 3 }] }, userId);
    expect(sale.total.toNumber()).toBe(12000);

    const breadInv = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: breadId, warehouseId } } });
    const pattyInv = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: pattyId, warehouseId } } });
    expect(breadInv!.quantity.toNumber()).toBe(17); // 20 - 3
    expect(pattyInv!.quantity.toNumber()).toBe(2); // 5 - 3
  });

  it('refuses the sale and rolls back completely when an ingredient is insufficient', async () => {
    await expect(createSale({ items: [{ menuItemId, quantity: 10 }] }, userId)).rejects.toThrow(/Insufficient stock/i);

    const breadInv = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: breadId, warehouseId } } });
    const pattyInv = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: pattyId, warehouseId } } });
    // Unchanged from the previous successful sale - proves the whole transaction rolled back,
    // not just the ingredient that ran out.
    expect(breadInv!.quantity.toNumber()).toBe(17);
    expect(pattyInv!.quantity.toNumber()).toBe(2);
  });

  it('reverses stock when a completed sale is cancelled', async () => {
    const sale = await createSale({ items: [{ menuItemId, quantity: 1 }] }, userId);
    const cancelled = await cancelSale(sale.id, userId);
    expect(cancelled.status).toBe('CANCELLED');

    const breadInv = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: breadId, warehouseId } } });
    expect(breadInv!.quantity.toNumber()).toBe(17); // 17 -1 (sale) +1 (cancel reversal) = 17
  });
});

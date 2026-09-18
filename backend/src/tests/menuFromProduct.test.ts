import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, createTestUser, createTestCategory, createTestUnit, createTestProduct, getTestSalesWarehouseId } from './helpers';
import { adjustStock } from '../services/stock.service';
import { ensureSellableMenuItem } from '../services/menuItem.service';
import { createSale } from '../services/sale.service';

describe('"List for Sale": turning a Product into a sellable MenuItem', () => {
  let managerId: string;
  let categoryId: string;
  let unitId: string;
  let warehouseId: string;
  let mandaziId: string;
  let unpricedId: string;

  beforeAll(async () => {
    const manager = await createTestUser('MANAGER');
    const category = await createTestCategory();
    const unit = await createTestUnit();
    // createSale() (no warehouse picker of its own) always resolves the shared Finished Goods
    // Store - use the real one.
    const mandazi = await createTestProduct({ categoryId: category.id, unitId: unit.id, type: 'FINISHED_PRODUCT', costPrice: 134 });
    await prisma.product.update({ where: { id: mandazi.id }, data: { sellingPrice: 300 } });
    const unpriced = await createTestProduct({ categoryId: category.id, unitId: unit.id, type: 'FINISHED_PRODUCT' });

    managerId = manager.id;
    categoryId = category.id;
    unitId = unit.id;
    warehouseId = await getTestSalesWarehouseId();
    mandaziId = mandazi.id;
    unpricedId = unpriced.id;

    await adjustStock({ productId: mandaziId, warehouseId, type: 'INCREASE', quantity: 100, reason: 'seed', userId: managerId });
  });

  afterAll(async () => {
    const productIds = [mandaziId, unpricedId];
    // Scoped to this test's own linked products, not the whole (shared) Finished Goods Store
    // warehouse - other test files sell from that same warehouse and must not be touched.
    await prisma.sale.deleteMany({ where: { items: { some: { menuItem: { linkedProductId: { in: productIds } } } } } });
    await prisma.saleItem.deleteMany({ where: { menuItem: { linkedProductId: { in: productIds } } } });
    await prisma.recipeIngredient.deleteMany({ where: { productId: { in: productIds } } });
    const linkedMenuItems = await prisma.menuItem.findMany({ where: { linkedProductId: { in: productIds } } });
    await prisma.recipe.deleteMany({ where: { menuItemId: { in: linkedMenuItems.map((m) => m.id) } } });
    await prisma.menuItem.deleteMany({ where: { linkedProductId: { in: productIds } } });
    await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.stockAdjustment.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.inventoryBatch.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.unit.deleteMany({ where: { id: unitId } });
    // warehouseId is the shared Finished Goods Store now - never delete it.
    await prisma.user.deleteMany({ where: { id: managerId } });
    await prisma.$disconnect();
  });

  it('rejects listing a product with no selling price', async () => {
    await expect(ensureSellableMenuItem(unpricedId, managerId)).rejects.toThrow(/selling price/i);
  });

  it('creates a MenuItem with a trivial 1:1 recipe the first time', async () => {
    const menuItem = await ensureSellableMenuItem(mandaziId, managerId);
    expect(menuItem.linkedProductId).toBe(mandaziId);
    expect(menuItem.name).toBe((await prisma.product.findUniqueOrThrow({ where: { id: mandaziId } })).name);
    expect(Number(menuItem.price)).toBe(300);

    const recipe = await prisma.recipe.findUnique({ where: { menuItemId: menuItem.id }, include: { ingredients: true } });
    expect(recipe).not.toBeNull();
    expect(recipe!.ingredients).toHaveLength(1);
    expect(recipe!.ingredients[0].productId).toBe(mandaziId);
    expect(recipe!.ingredients[0].quantity.toNumber()).toBe(1);
  });

  it('is idempotent: calling it again reuses the same MenuItem instead of creating a duplicate', async () => {
    const first = await ensureSellableMenuItem(mandaziId, managerId);
    const second = await ensureSellableMenuItem(mandaziId, managerId);
    expect(second.id).toBe(first.id);

    const count = await prisma.menuItem.count({ where: { linkedProductId: mandaziId } });
    expect(count).toBe(1);
  });

  it('selling through the listed MenuItem deducts exactly the product itself, 1:1, not any raw materials', async () => {
    const menuItem = await ensureSellableMenuItem(mandaziId, managerId);
    const before = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: mandaziId, warehouseId } } });

    await createSale({ items: [{ menuItemId: menuItem.id, quantity: 5 }] }, managerId);

    const after = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: mandaziId, warehouseId } } });
    expect(after!.quantity.toNumber()).toBe(before!.quantity.toNumber() - 5);
  });
});

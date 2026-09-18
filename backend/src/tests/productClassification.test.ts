import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, createTestUser, createTestCategory, createTestUnit, createTestWarehouse, createTestProduct, uniqueSuffix } from './helpers';
import { adjustStock } from '../services/stock.service';
import { listProducts } from '../services/product.service';
import { createProduction } from '../services/production.service';
import { createRecipe, listRecipes } from '../services/recipe.service';

describe('product classification (Product.type) drives Production dropdowns', () => {
  let managerId: string;
  let categoryId: string;
  let unitId: string;
  let kitchenId: string;
  let flourId: string; // RAW_MATERIAL
  let sugarId: string; // RAW_MATERIAL
  let mandaziId: string; // FINISHED_PRODUCT
  let breadId: string; // FINISHED_PRODUCT
  let bottledWaterId: string; // DIRECT_SALE
  let unclassifiedId: string; // type left null - pre-existing-product simulation

  beforeAll(async () => {
    const manager = await createTestUser('MANAGER');
    const category = await createTestCategory();
    const unit = await createTestUnit();
    const kitchen = await createTestWarehouse();

    const flour = await createTestProduct({ categoryId: category.id, unitId: unit.id, costPrice: 900, type: 'RAW_MATERIAL' });
    const sugar = await createTestProduct({ categoryId: category.id, unitId: unit.id, costPrice: 1500, type: 'RAW_MATERIAL' });
    const mandazi = await createTestProduct({ categoryId: category.id, unitId: unit.id, type: 'FINISHED_PRODUCT' });
    const bread = await createTestProduct({ categoryId: category.id, unitId: unit.id, type: 'FINISHED_PRODUCT' });
    const bottledWater = await createTestProduct({ categoryId: category.id, unitId: unit.id, type: 'DIRECT_SALE' });
    const unclassified = await createTestProduct({ categoryId: category.id, unitId: unit.id });

    managerId = manager.id;
    categoryId = category.id;
    unitId = unit.id;
    kitchenId = kitchen.id;
    flourId = flour.id;
    sugarId = sugar.id;
    mandaziId = mandazi.id;
    breadId = bread.id;
    bottledWaterId = bottledWater.id;
    unclassifiedId = unclassified.id;

    await adjustStock({ productId: flourId, warehouseId: kitchenId, type: 'INCREASE', quantity: 50, reason: 'seed', userId: managerId });
    await adjustStock({ productId: sugarId, warehouseId: kitchenId, type: 'INCREASE', quantity: 50, reason: 'seed', userId: managerId });
  });

  afterAll(async () => {
    const productIds = [flourId, sugarId, mandaziId, breadId, bottledWaterId, unclassifiedId];
    await prisma.recipeIngredient.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.recipe.deleteMany({ where: { name: { contains: 'Test' } } });
    await prisma.productionMaterial.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.production.deleteMany({ where: { finishedProductId: { in: productIds } } });
    await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.stockAdjustment.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.inventoryBatch.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.unit.deleteMany({ where: { id: unitId } });
    await prisma.warehouse.deleteMany({ where: { id: kitchenId } });
    await prisma.user.deleteMany({ where: { id: managerId } });
    await prisma.$disconnect();
  });

  it('Test 1: filtering products by type=FINISHED_PRODUCT returns only finished products, never raw materials or direct-sale', async () => {
    const { data } = await listProducts({ type: 'FINISHED_PRODUCT', limit: 100 });
    const ids = data.map((p) => p.id);
    expect(ids).toContain(mandaziId);
    expect(ids).toContain(breadId);
    expect(ids).not.toContain(flourId);
    expect(ids).not.toContain(sugarId);
    expect(ids).not.toContain(bottledWaterId);
    expect(ids).not.toContain(unclassifiedId);
  });

  it('Test 2: filtering products by type=RAW_MATERIAL returns only raw materials', async () => {
    const { data } = await listProducts({ type: 'RAW_MATERIAL', limit: 100 });
    const ids = data.map((p) => p.id);
    expect(ids).toContain(flourId);
    expect(ids).toContain(sugarId);
    expect(ids).not.toContain(mandaziId);
    expect(ids).not.toContain(breadId);
    expect(ids).not.toContain(bottledWaterId);
  });

  it('rejects a Production run whose "finished product" is actually classified as something else', async () => {
    await expect(
      createProduction(
        { finishedProductId: bottledWaterId, plannedQuantity: 10, sourceWarehouseId: kitchenId, materials: [{ productId: flourId, quantity: 1 }] },
        managerId,
      ),
    ).rejects.toThrow(/direct sale/i);

    await expect(
      createProduction(
        { finishedProductId: flourId, plannedQuantity: 10, sourceWarehouseId: kitchenId, materials: [{ productId: sugarId, quantity: 1 }] },
        managerId,
      ),
    ).rejects.toThrow(/raw material/i);
  });

  it('rejects a raw material that is actually classified as a finished product', async () => {
    // Give the finished product some kitchen stock first so the assignment check passes and the
    // type check is what actually fails.
    await adjustStock({ productId: mandaziId, warehouseId: kitchenId, type: 'INCREASE', quantity: 5, reason: 'seed', userId: managerId });
    await expect(
      createProduction(
        { finishedProductId: breadId, plannedQuantity: 10, sourceWarehouseId: kitchenId, materials: [{ productId: mandaziId, quantity: 1 }] },
        managerId,
      ),
    ).rejects.toThrow(/finished product/i);
  });

  it('backward compatibility: an unclassified (type = null) product is still accepted anywhere, exactly as before this feature', async () => {
    await adjustStock({ productId: unclassifiedId, warehouseId: kitchenId, type: 'INCREASE', quantity: 20, reason: 'seed', userId: managerId });
    // Unclassified as the finished product being produced. Destination pinned to kitchenId
    // (not the default Finished Goods Store) since this product is already assigned to
    // kitchenId from the adjustStock() above - this test is about type leniency, not warehouse
    // defaulting (covered separately), so avoid the unrelated cross-warehouse assignment check.
    const asFinished = await createProduction(
      {
        finishedProductId: unclassifiedId,
        plannedQuantity: 5,
        sourceWarehouseId: kitchenId,
        destinationWarehouseId: kitchenId,
        materials: [{ productId: flourId, quantity: 1 }],
      },
      managerId,
    );
    expect(asFinished.status).toBe('DRAFT');

    // Unclassified as a raw material. Destination pinned to kitchenId for the same reason as
    // above - mandaziId already has stock assigned there from an earlier test in this file.
    const asMaterial = await createProduction(
      {
        finishedProductId: mandaziId,
        plannedQuantity: 5,
        sourceWarehouseId: kitchenId,
        destinationWarehouseId: kitchenId,
        materials: [{ productId: unclassifiedId, quantity: 1 }],
      },
      managerId,
    );
    expect(asMaterial.status).toBe('DRAFT');
  });

  it('Recipe.finishedProductId lets Production load an existing recipe by finished product', async () => {
    const recipe = await createRecipe(
      {
        name: `Test Mandazi Recipe ${uniqueSuffix()}`,
        finishedProductId: mandaziId,
        ingredients: [
          { productId: flourId, quantity: 10 },
          { productId: sugarId, quantity: 1 },
        ],
      },
      managerId,
    );
    expect(recipe.finishedProductId).toBe(mandaziId);

    const { data } = await listRecipes({ finishedProductId: mandaziId, limit: 1 });
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe(recipe.id);
    expect(data[0].ingredients).toHaveLength(2);

    // Bread has no recipe linked - the lookup must come back empty, not throw.
    const { data: noneForBread } = await listRecipes({ finishedProductId: breadId, limit: 1 });
    expect(noneForBread).toHaveLength(0);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, createTestUser, createTestCategory, createTestUnit, createTestWarehouse, createTestProduct, uniqueSuffix, getTestSalesWarehouseId } from './helpers';
import { adjustStock } from '../services/stock.service';
import { createProduction, completeProduction, cancelProduction, getProductionById } from '../services/production.service';
import { getNetProfit } from '../services/reports.service';

describe('production: raw materials -> finished product', () => {
  let managerId: string;
  let categoryId: string;
  let unitId: string;
  let kitchenId: string; // source
  let coldRoomId: string; // a second, independent source warehouse
  let bakeryId: string; // destination
  let flourId: string;
  let oilId: string;
  let sugarId: string; // stocked in coldRoomId, not kitchenId
  let mandaziId: string; // finished product, perishable (3 days)

  beforeAll(async () => {
    const manager = await createTestUser('MANAGER');
    const category = await createTestCategory();
    const unit = await createTestUnit();
    const kitchen = await createTestWarehouse();
    const coldRoom = await createTestWarehouse();
    // createProduction()'s default destination, and createSale()'s only warehouse, are both
    // the shared Finished Goods Store now - use the real one so a produced item is actually
    // sellable in these tests, exactly as it is for real users.
    const bakeryWarehouseId = await getTestSalesWarehouseId();
    const flour = await createTestProduct({ categoryId: category.id, unitId: unit.id, costPrice: 900 });
    const oil = await createTestProduct({ categoryId: category.id, unitId: unit.id, costPrice: 2200 });
    const sugar = await createTestProduct({ categoryId: category.id, unitId: unit.id, costPrice: 1500 });
    const mandazi = await createTestProduct({ categoryId: category.id, unitId: unit.id, isPerishable: true, shelfLifeDays: 3 });

    managerId = manager.id;
    categoryId = category.id;
    unitId = unit.id;
    kitchenId = kitchen.id;
    coldRoomId = coldRoom.id;
    bakeryId = bakeryWarehouseId;
    flourId = flour.id;
    oilId = oil.id;
    sugarId = sugar.id;
    mandaziId = mandazi.id;

    // Stock the raw materials in the kitchen (source) warehouse.
    await adjustStock({ productId: flourId, warehouseId: kitchenId, type: 'INCREASE', quantity: 50, reason: 'seed', userId: managerId });
    await adjustStock({ productId: oilId, warehouseId: kitchenId, type: 'INCREASE', quantity: 10, reason: 'seed', userId: managerId });
    // Sugar lives in a different warehouse entirely, for the per-material-warehouse tests below.
    await adjustStock({ productId: sugarId, warehouseId: coldRoomId, type: 'INCREASE', quantity: 20, reason: 'seed', userId: managerId });
  });

  afterAll(async () => {
    if (!kitchenId) {
      await prisma.$disconnect();
      return;
    }
    const productIds = [flourId, oilId, sugarId, mandaziId];
    // Scoped to this test's own menu items/products, not the whole (shared) Finished Goods
    // Store warehouse - other test files sell from that same warehouse and must not be touched.
    await prisma.sale.deleteMany({ where: { items: { some: { menuItem: { name: { contains: 'Test' } } } } } });
    await prisma.saleItem.deleteMany({ where: { menuItem: { name: { contains: 'Test' } } } });
    await prisma.recipeIngredient.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.recipe.deleteMany({ where: { name: { contains: 'Test' } } });
    await prisma.menuItem.deleteMany({ where: { name: { contains: 'Test' } } });
    await prisma.productionMaterial.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.production.deleteMany({ where: { finishedProductId: mandaziId } });
    await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.stockAdjustment.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.inventoryBatch.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.unit.deleteMany({ where: { id: unitId } });
    // bakeryId is the shared Finished Goods Store now - only delete our own private warehouses.
    await prisma.warehouse.deleteMany({ where: { id: { in: [kitchenId, coldRoomId] } } });
    await prisma.user.deleteMany({ where: { id: managerId } });
    await prisma.$disconnect();
  });

  it('creates a DRAFT run without touching any stock', async () => {
    const production = await createProduction(
      {
        finishedProductId: mandaziId,
        plannedQuantity: 100,
        sourceWarehouseId: kitchenId,
        destinationWarehouseId: bakeryId,
        batchNumber: `BATCH-${uniqueSuffix()}`,
        notes: 'First test batch',
        materials: [
          { productId: flourId, quantity: 10 },
          { productId: oilId, quantity: 2 },
        ],
      },
      managerId,
    );

    expect(production.status).toBe('DRAFT');
    expect(production.materials).toHaveLength(2);

    const flourInv = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: flourId, warehouseId: kitchenId } } });
    const mandaziInv = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: mandaziId, warehouseId: bakeryId } } });
    expect(flourInv!.quantity.toNumber()).toBe(50); // unchanged
    expect(mandaziInv).toBeNull(); // not created yet
  });

  it('completing a run consumes raw materials, yields the finished product with computed cost, and creates a dated batch', async () => {
    const production = await createProduction(
      {
        finishedProductId: mandaziId,
        plannedQuantity: 100,
        sourceWarehouseId: kitchenId,
        destinationWarehouseId: bakeryId,
        materials: [
          { productId: flourId, quantity: 10 }, // 10 * 900 = 9000
          { productId: oilId, quantity: 2 }, // 2 * 2200 = 4400
        ],
      },
      managerId,
    );

    const before = Date.now();
    const completed = await completeProduction(production.id, {}, managerId);
    const after = Date.now();

    expect(completed.status).toBe('COMPLETED');
    expect(completed.actualQuantity?.toNumber()).toBe(100);
    // total raw material cost = 9000 + 4400 = 13400, over 100 units = 134/unit
    expect(completed.totalCost?.toNumber()).toBe(13400);
    expect(completed.unitCost?.toNumber()).toBeCloseTo(134, 5);

    const flourInv = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: flourId, warehouseId: kitchenId } } });
    const oilInv = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: oilId, warehouseId: kitchenId } } });
    expect(flourInv!.quantity.toNumber()).toBe(40); // 50 - 10
    expect(oilInv!.quantity.toNumber()).toBe(8); // 10 - 2

    const mandaziInv = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: mandaziId, warehouseId: bakeryId } } });
    expect(mandaziInv!.quantity.toNumber()).toBe(100);
    expect(mandaziInv!.averageCost.toNumber()).toBeCloseTo(134, 5);

    const batch = await prisma.inventoryBatch.findFirst({ where: { productId: mandaziId, warehouseId: bakeryId } });
    expect(batch).not.toBeNull();
    expect(batch!.expiryDate).not.toBeNull();
    const expectedMin = before + 3 * 24 * 60 * 60 * 1000;
    const expectedMax = after + 3 * 24 * 60 * 60 * 1000;
    expect(batch!.expiryDate!.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(batch!.expiryDate!.getTime()).toBeLessThanOrEqual(expectedMax);
    // No batch number was given on the form - the production run's own number stands in for it,
    // so the yield stays traceable without the user typing anything.
    expect(batch!.batchNumber).toBe(production.productionNumber);

    // Product.costPrice (what Sale COGS and reports.service.ts actually read - see
    // production.service.ts) settles to the real cost this batch was just produced at, not
    // whatever placeholder it had before - a produced item is never "purchased" so nothing else
    // would ever have set it correctly.
    const mandaziProduct = await prisma.product.findUnique({ where: { id: mandaziId } });
    expect(mandaziProduct!.costPrice.toNumber()).toBeCloseTo(134, 5);

    const movements = await prisma.stockMovement.findMany({ where: { referenceType: 'PRODUCTION', referenceId: production.id } });
    expect(movements.filter((m) => m.type === 'PRODUCTION_CONSUME')).toHaveLength(2);
    expect(movements.filter((m) => m.type === 'PRODUCTION_YIELD')).toHaveLength(1);
  });

  it('lets a produced batch be partially sold and keeps the remainder in inventory', async () => {
    const menuItem = await prisma.menuItem.create({ data: { name: `Test Mandazi ${uniqueSuffix()}`, price: 300 } });
    await prisma.recipe.create({
      data: { name: `Test Mandazi Recipe ${uniqueSuffix()}`, menuItemId: menuItem.id, ingredients: { create: [{ productId: mandaziId, quantity: 1 }] } },
    });

    const { createSale } = await import('../services/sale.service');
    await createSale({ items: [{ menuItemId: menuItem.id, quantity: 50 }] }, managerId);

    const mandaziInv = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: mandaziId, warehouseId: bakeryId } } });
    // 100 produced, 50 sold - the other 50 must NOT be auto-consumed or removed.
    expect(mandaziInv!.quantity.toNumber()).toBe(50);
  });

  it('a lower actual yield than planned only inventories what was actually produced', async () => {
    const production = await createProduction(
      {
        finishedProductId: mandaziId,
        plannedQuantity: 20,
        sourceWarehouseId: kitchenId,
        destinationWarehouseId: bakeryId,
        materials: [{ productId: flourId, quantity: 4 }],
      },
      managerId,
    );

    const before = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: mandaziId, warehouseId: bakeryId } } });
    const completed = await completeProduction(production.id, { actualQuantity: 15 }, managerId);
    expect(completed.actualQuantity?.toNumber()).toBe(15);

    const after = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: mandaziId, warehouseId: bakeryId } } });
    expect(after!.quantity.toNumber()).toBe(before!.quantity.toNumber() + 15); // not 20
  });

  it('rejects completing an already-completed production, and rejects raw materials not assigned to the source warehouse', async () => {
    const production = await createProduction(
      { finishedProductId: mandaziId, plannedQuantity: 5, sourceWarehouseId: kitchenId, destinationWarehouseId: bakeryId, materials: [{ productId: flourId, quantity: 1 }] },
      managerId,
    );
    await completeProduction(production.id, {}, managerId);
    await expect(completeProduction(production.id, {}, managerId)).rejects.toThrow(/completed/i);

    const unassignedProduct = await createTestProduct({ categoryId, unitId });
    await expect(
      createProduction(
        { finishedProductId: mandaziId, plannedQuantity: 5, sourceWarehouseId: kitchenId, destinationWarehouseId: bakeryId, materials: [{ productId: unassignedProduct.id, quantity: 1 }] },
        managerId,
      ),
    ).rejects.toThrow(/not assigned/i);
    await prisma.product.deleteMany({ where: { id: unassignedProduct.id } });
  });

  it('cancelling a draft leaves stock completely untouched', async () => {
    const production = await createProduction(
      { finishedProductId: mandaziId, plannedQuantity: 5, sourceWarehouseId: kitchenId, destinationWarehouseId: bakeryId, materials: [{ productId: flourId, quantity: 1 }] },
      managerId,
    );
    const before = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: flourId, warehouseId: kitchenId } } });
    const cancelled = await cancelProduction(production.id, managerId);
    expect(cancelled.status).toBe('CANCELLED');
    const after = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: flourId, warehouseId: kitchenId } } });
    expect(after!.quantity.toNumber()).toBe(before!.quantity.toNumber());

    await expect(completeProduction(production.id, {}, managerId)).rejects.toThrow(/cancelled/i);
  });

  it('does not double-count production consumption/yield in Net Profit (they are distinct from CONSUMPTION/ADJUSTMENT)', async () => {
    const before = await getNetProfit({});
    const production = await createProduction(
      { finishedProductId: mandaziId, plannedQuantity: 3, sourceWarehouseId: kitchenId, destinationWarehouseId: bakeryId, materials: [{ productId: flourId, quantity: 1 }] },
      managerId,
    );
    await completeProduction(production.id, {}, managerId);
    const after = await getNetProfit({});

    // Production movements use distinct StockMovementType values, so they must never appear in
    // the existing consumption/adjustment figures - only a later sale of the finished good
    // (via COGS, already covered above) touches profit.
    expect(after.consumptionCost).toBeCloseTo(before.consumptionCost, 5);
    expect(after.adjustmentLossCost).toBeCloseTo(before.adjustmentLossCost, 5);
    expect(after.adjustmentGainValue).toBeCloseTo(before.adjustmentGainValue, 5);

    const production2 = await getProductionById(production.id);
    expect(production2.status).toBe('COMPLETED');
  });

  it('pulls materials from different warehouses in the same run, and falls back to sourceWarehouseId when a material omits its own', async () => {
    const production = await createProduction(
      {
        finishedProductId: mandaziId,
        plannedQuantity: 10,
        sourceWarehouseId: kitchenId,
        destinationWarehouseId: bakeryId,
        materials: [
          { productId: flourId, quantity: 5 }, // no warehouseId -> falls back to sourceWarehouseId (kitchenId)
          { productId: sugarId, quantity: 2, warehouseId: coldRoomId }, // explicit override
        ],
      },
      managerId,
    );
    expect(production.materials.find((m) => m.productId === flourId)?.warehouseId).toBe(kitchenId);
    expect(production.materials.find((m) => m.productId === sugarId)?.warehouseId).toBe(coldRoomId);

    const flourBefore = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: flourId, warehouseId: kitchenId } } });
    const sugarBefore = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: sugarId, warehouseId: coldRoomId } } });

    await completeProduction(production.id, {}, managerId);

    const flourAfter = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: flourId, warehouseId: kitchenId } } });
    const sugarAfter = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: sugarId, warehouseId: coldRoomId } } });
    expect(flourAfter!.quantity.toNumber()).toBe(flourBefore!.quantity.toNumber() - 5);
    expect(sugarAfter!.quantity.toNumber()).toBe(sugarBefore!.quantity.toNumber() - 2);

    // Sugar was never assigned to kitchenId - confirms it really was drawn from coldRoomId, not
    // silently pulled from the run's default sourceWarehouseId.
    const sugarInKitchen = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: sugarId, warehouseId: kitchenId } } });
    expect(sugarInKitchen).toBeNull();
  });

  it('rejects a material warehouse override that does not actually hold that product', async () => {
    await expect(
      createProduction(
        {
          finishedProductId: mandaziId,
          plannedQuantity: 5,
          sourceWarehouseId: kitchenId,
          destinationWarehouseId: bakeryId,
          // Flour is stocked in kitchenId, not coldRoomId.
          materials: [{ productId: flourId, quantity: 1, warehouseId: coldRoomId }],
        },
        managerId,
      ),
    ).rejects.toThrow(/not assigned/i);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, createTestUser, createTestCategory, createTestUnit, createTestWarehouse, createTestProduct } from './helpers';
import { adjustStock, consumeStock, transferStock } from '../services/stock.service';
import { applyStockMovement } from '../services/inventory.service';

describe('stock ledger accuracy', () => {
  let userId: string;
  let productId: string;
  let warehouseId: string;
  let categoryId: string;
  let unitId: string;

  beforeAll(async () => {
    const user = await createTestUser('MANAGER');
    const category = await createTestCategory();
    const unit = await createTestUnit();
    const warehouse = await createTestWarehouse();
    const product = await createTestProduct({ categoryId: category.id, unitId: unit.id, minimumStock: 20 });

    userId = user.id;
    productId = product.id;
    warehouseId = warehouse.id;
    categoryId = category.id;
    unitId = unit.id;
  });

  afterAll(async () => {
    if (!productId) {
      await prisma.$disconnect();
      return;
    }
    await prisma.stockMovement.deleteMany({ where: { productId } });
    await prisma.stockAdjustment.deleteMany({ where: { productId } });
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.unit.deleteMany({ where: { id: unitId } });
    await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('increases stock via a positive adjustment and records an accurate movement', async () => {
    const { adjustment, movement, inventory } = await adjustStock({
      productId,
      warehouseId,
      type: 'INCREASE',
      quantity: 50,
      reason: 'Opening balance',
      userId,
    });

    expect(adjustment.quantity.toNumber()).toBe(50);
    expect(movement.previousQuantity.toNumber()).toBe(0);
    expect(movement.newQuantity.toNumber()).toBe(50);
    expect(inventory.quantity.toNumber()).toBe(50);
  });

  it('reduces stock on consumption and keeps the ledger consistent', async () => {
    const { movement, inventory } = await consumeStock({ productId, warehouseId, quantity: 15, userId });

    expect(movement.quantity.toNumber()).toBe(-15);
    expect(movement.previousQuantity.toNumber()).toBe(50);
    expect(movement.newQuantity.toNumber()).toBe(35);
    expect(inventory.quantity.toNumber()).toBe(35);
  });

  it('prevents stock from going negative by default', async () => {
    await expect(consumeStock({ productId, warehouseId, quantity: 1000, userId })).rejects.toThrow(/Insufficient stock/i);

    // Confirm the failed attempt did not mutate inventory.
    const inventory = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId, warehouseId } } });
    expect(inventory!.quantity.toNumber()).toBe(35);
  });

  it('allows negative stock only when explicitly permitted', async () => {
    await prisma.$transaction(async (tx) => {
      const { inventory } = await applyStockMovement(tx, {
        productId,
        warehouseId,
        type: 'ADJUSTMENT',
        signedQuantity: -1000,
        reason: 'force negative for test',
        createdById: userId,
        allowNegative: true,
      });
      expect(inventory.quantity.toNumber()).toBe(-965);
      // Roll back this probe so it doesn't pollute later assertions.
      throw new Error('rollback');
    }).catch(() => undefined);

    const inventory = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId, warehouseId } } });
    expect(inventory!.quantity.toNumber()).toBe(35);
  });
});

describe('stock transfers carry the cost basis to the destination warehouse', () => {
  let userId: string;
  let productId: string;
  let categoryId: string;
  let unitId: string;
  let warehouseAId: string;
  let warehouseBId: string;

  beforeAll(async () => {
    const user = await createTestUser('MANAGER');
    const category = await createTestCategory();
    const unit = await createTestUnit();
    const warehouseA = await createTestWarehouse();
    const warehouseB = await createTestWarehouse();
    const product = await createTestProduct({ categoryId: category.id, unitId: unit.id });

    userId = user.id;
    productId = product.id;
    categoryId = category.id;
    unitId = unit.id;
    warehouseAId = warehouseA.id;
    warehouseBId = warehouseB.id;

    // Seed each warehouse with its own cost basis, as if each had received its own purchase.
    await prisma.$transaction(async (tx) => {
      await applyStockMovement(tx, {
        productId,
        warehouseId: warehouseAId,
        type: 'PURCHASE',
        signedQuantity: 100,
        unitCost: 500,
        createdById: userId,
      });
      await applyStockMovement(tx, {
        productId,
        warehouseId: warehouseBId,
        type: 'PURCHASE',
        signedQuantity: 20,
        unitCost: 800,
        createdById: userId,
      });
    });
  });

  afterAll(async () => {
    if (!productId) {
      await prisma.$disconnect();
      return;
    }
    await prisma.stockMovement.deleteMany({ where: { productId } });
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.unit.deleteMany({ where: { id: unitId } });
    await prisma.warehouse.deleteMany({ where: { id: { in: [warehouseAId, warehouseBId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('blends the transferred cost into the destination\'s weighted-average cost, not just its quantity', async () => {
    // A: 100 @ 500. B: 20 @ 800. Transfer 40 from A to B.
    await transferStock({ productId, fromWarehouseId: warehouseAId, toWarehouseId: warehouseBId, quantity: 40, userId });

    const destination = await prisma.inventory.findUnique({
      where: { productId_warehouseId: { productId, warehouseId: warehouseBId } },
    });
    expect(destination!.quantity.toNumber()).toBe(60); // 20 + 40
    // (20*800 + 40*500) / 60 = (16000 + 20000) / 60 = 600
    expect(destination!.averageCost.toNumber()).toBe(600);
    expect(destination!.quantity.mul(destination!.averageCost).toNumber()).toBe(36000);

    const source = await prisma.inventory.findUnique({
      where: { productId_warehouseId: { productId, warehouseId: warehouseAId } },
    });
    expect(source!.quantity.toNumber()).toBe(60); // 100 - 40
    expect(source!.averageCost.toNumber()).toBe(500); // outflow never changes the source's own cost basis
  });

  it('gives a brand-new destination exactly the source\'s cost, not zero', async () => {
    const warehouseC = await createTestWarehouse();
    await transferStock({ productId, fromWarehouseId: warehouseAId, toWarehouseId: warehouseC.id, quantity: 10, userId });

    const fresh = await prisma.inventory.findUnique({
      where: { productId_warehouseId: { productId, warehouseId: warehouseC.id } },
    });
    expect(fresh!.quantity.toNumber()).toBe(10);
    expect(fresh!.averageCost.toNumber()).toBe(500);

    await prisma.stockMovement.deleteMany({ where: { productId, warehouseId: warehouseC.id } });
    await prisma.inventory.deleteMany({ where: { productId, warehouseId: warehouseC.id } });
    await prisma.warehouse.deleteMany({ where: { id: warehouseC.id } });
  });
});

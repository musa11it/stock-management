import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, createTestUser, createTestCategory, createTestUnit, createTestProduct, uniqueSuffix } from './helpers';
import { adjustStock } from '../services/stock.service';
import { createCustomerOrder, getOrderForCustomer, updateSaleStatus } from '../services/sale.service';

describe('customer ordering deducts stock and staff manage fulfillment', () => {
  let customerId: string;
  let otherCustomerId: string;
  let staffId: string;
  let warehouseId: string;
  let categoryId: string;
  let unitId: string;
  let breadId: string;
  let menuItemId: string;

  beforeAll(async () => {
    const customer = await createTestUser('RETAIL_USER');
    const otherCustomer = await createTestUser('RETAIL_USER');
    const staff = await createTestUser('MANAGER');
    const category = await createTestCategory();
    const unit = await createTestUnit();
    // getDefaultWarehouseId() picks the oldest active warehouse - backdate this one so the
    // test deterministically targets it without touching any other (e.g. seed) warehouse.
    const warehouse = await prisma.warehouse.create({ data: { name: `Test Warehouse ${uniqueSuffix()}`, createdAt: new Date(0) } });
    const bread = await createTestProduct({ categoryId: category.id, unitId: unit.id });

    customerId = customer.id;
    otherCustomerId = otherCustomer.id;
    staffId = staff.id;
    categoryId = category.id;
    unitId = unit.id;
    warehouseId = warehouse.id;
    breadId = bread.id;

    await adjustStock({ productId: breadId, warehouseId, type: 'INCREASE', quantity: 10, reason: 'seed', userId: staffId });

    const menuItem = await prisma.menuItem.create({ data: { name: `Test Snack ${uniqueSuffix()}`, price: 2000 } });
    menuItemId = menuItem.id;
    await prisma.recipe.create({
      data: { name: `Test Snack Recipe ${uniqueSuffix()}`, menuItemId, ingredients: { create: [{ productId: breadId, quantity: 2 }] } },
    });
  });

  afterAll(async () => {
    if (!breadId || !menuItemId) {
      await prisma.$disconnect();
      return;
    }
    await prisma.saleItem.deleteMany({ where: { menuItemId } });
    await prisma.sale.deleteMany({ where: { customerId: { in: [customerId, otherCustomerId] } } });
    await prisma.stockMovement.deleteMany({ where: { productId: breadId } });
    await prisma.stockAdjustment.deleteMany({ where: { productId: breadId } });
    await prisma.recipeIngredient.deleteMany({ where: { productId: breadId } });
    await prisma.recipe.deleteMany({ where: { menuItemId } });
    await prisma.menuItem.deleteMany({ where: { id: menuItemId } });
    await prisma.inventory.deleteMany({ where: { productId: breadId } });
    await prisma.product.deleteMany({ where: { id: breadId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.unit.deleteMany({ where: { id: unitId } });
    await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
    await prisma.user.deleteMany({ where: { id: { in: [customerId, otherCustomerId, staffId] } } });
    await prisma.$disconnect();
  });

  it('placing an order deducts stock immediately and starts PENDING', async () => {
    const order = await createCustomerOrder({ items: [{ menuItemId, quantity: 2 }] }, customerId);
    expect(order.status).toBe('PENDING');
    expect(order.source).toBe('ONLINE');
    expect(order.customerId).toBe(customerId);
    expect(order.total.toNumber()).toBe(4000);

    const inventory = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: breadId, warehouseId } } });
    expect(inventory!.quantity.toNumber()).toBe(6); // 10 - (2 qty * 2 per item)
  });

  it('a customer cannot see another customer\'s order', async () => {
    const order = await createCustomerOrder({ items: [{ menuItemId, quantity: 1 }] }, otherCustomerId);
    await expect(getOrderForCustomer(order.id, customerId)).rejects.toThrow(/not found/i);
    const ownView = await getOrderForCustomer(order.id, otherCustomerId);
    expect(ownView.id).toBe(order.id);
  });

  it('staff fulfilling a pending order does not change stock further', async () => {
    const order = await createCustomerOrder({ items: [{ menuItemId, quantity: 1 }] }, customerId);
    const before = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: breadId, warehouseId } } });

    const fulfilled = await updateSaleStatus(order.id, 'COMPLETED', staffId);
    expect(fulfilled.status).toBe('COMPLETED');

    const after = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: breadId, warehouseId } } });
    expect(after!.quantity.toNumber()).toBe(before!.quantity.toNumber());
  });

  it('cancelling a pending order reverses the stock it had reserved', async () => {
    const before = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: breadId, warehouseId } } });
    const order = await createCustomerOrder({ items: [{ menuItemId, quantity: 1 }] }, customerId);

    const cancelled = await updateSaleStatus(order.id, 'CANCELLED', staffId);
    expect(cancelled.status).toBe('CANCELLED');

    const after = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: breadId, warehouseId } } });
    expect(after!.quantity.toNumber()).toBe(before!.quantity.toNumber());
  });

  it('rejects an invalid status transition out of a terminal state', async () => {
    const order = await createCustomerOrder({ items: [{ menuItemId, quantity: 1 }] }, customerId);
    await updateSaleStatus(order.id, 'CANCELLED', staffId);
    await expect(updateSaleStatus(order.id, 'COMPLETED', staffId)).rejects.toThrow(/cannot move/i);
  });

  it('refuses the order and leaves stock untouched when there is not enough of an ingredient', async () => {
    const before = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: breadId, warehouseId } } });
    await expect(createCustomerOrder({ items: [{ menuItemId, quantity: 100 }] }, customerId)).rejects.toThrow(/insufficient stock/i);
    const after = await prisma.inventory.findUnique({ where: { productId_warehouseId: { productId: breadId, warehouseId } } });
    expect(after!.quantity.toNumber()).toBe(before!.quantity.toNumber());
  });
});

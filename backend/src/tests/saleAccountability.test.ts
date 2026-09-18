import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, createTestUser, createTestCategory, createTestUnit, createTestProduct, uniqueSuffix, getTestSalesWarehouseId } from './helpers';
import { adjustStock } from '../services/stock.service';
import { createSale, createCustomerOrder, updateSaleStatus, getOrderForCustomer } from '../services/sale.service';

describe('sale/order accountability (who created it, who confirmed it)', () => {
  let staffId: string;
  let managerId: string;
  let customerId: string;
  let warehouseId: string;
  let breadId: string;
  let menuItemId: string;
  let categoryId: string;
  let unitId: string;

  beforeAll(async () => {
    const staff = await createTestUser('STAFF');
    const manager = await createTestUser('MANAGER');
    const customer = await createTestUser('RETAIL_USER');
    const category = await createTestCategory();
    const unit = await createTestUnit();
    // createSale()/createCustomerOrder() always resolve the shared Finished Goods Store
    // internally - use the real one, not a private test warehouse.
    const bread = await createTestProduct({ categoryId: category.id, unitId: unit.id });

    staffId = staff.id;
    managerId = manager.id;
    customerId = customer.id;
    categoryId = category.id;
    unitId = unit.id;
    warehouseId = await getTestSalesWarehouseId();
    breadId = bread.id;

    await adjustStock({ productId: breadId, warehouseId, type: 'INCREASE', quantity: 50, reason: 'seed', userId: staffId });

    const menuItem = await prisma.menuItem.create({ data: { name: `Test Snack ${uniqueSuffix()}`, price: 1000 } });
    menuItemId = menuItem.id;
    await prisma.recipe.create({
      data: { name: `Test Snack Recipe ${uniqueSuffix()}`, menuItemId, ingredients: { create: [{ productId: breadId, quantity: 1 }] } },
    });
  });

  afterAll(async () => {
    if (!breadId) {
      await prisma.$disconnect();
      return;
    }
    // Scoped to this test's own menuItemId, not the whole (shared) warehouse - other test files
    // create sales in the same Finished Goods Store warehouse and must not be touched here.
    await prisma.sale.deleteMany({ where: { items: { some: { menuItemId } } } });
    await prisma.saleItem.deleteMany({ where: { menuItemId } });
    await prisma.stockMovement.deleteMany({ where: { productId: breadId } });
    await prisma.stockAdjustment.deleteMany({ where: { productId: breadId } });
    await prisma.recipeIngredient.deleteMany({ where: { productId: breadId } });
    await prisma.recipe.deleteMany({ where: { menuItemId } });
    await prisma.menuItem.deleteMany({ where: { id: menuItemId } });
    await prisma.inventoryBatch.deleteMany({ where: { productId: breadId } });
    await prisma.inventory.deleteMany({ where: { productId: breadId } });
    await prisma.product.deleteMany({ where: { id: breadId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.unit.deleteMany({ where: { id: unitId } });
    // warehouseId is the shared Finished Goods Store now - never delete it.
    await prisma.user.deleteMany({ where: { id: { in: [staffId, managerId, customerId] } } });
    await prisma.$disconnect();
  });

  it('does not require (or accept storing) a warehouse from the POS sale creator, and self-confirms it', async () => {
    const sale = await createSale({ items: [{ menuItemId, quantity: 2 }] }, staffId);

    expect(sale.status).toBe('COMPLETED');
    expect(sale.createdById).toBe(staffId);
    expect(sale.createdBy.role.name).toBe('STAFF');
    // Rung up and completed in one step - the creator is also the confirmer.
    expect(sale.confirmedById).toBe(staffId);
    expect(sale.confirmedBy?.role.name).toBe('STAFF');
    expect(sale.confirmedAt).not.toBeNull();
    // Warehouse was still resolved and applied internally, just never supplied by the caller.
    expect(sale.warehouseId).toBe(warehouseId);
  });

  it('leaves confirmedBy empty on a freshly placed customer order until staff accept it', async () => {
    const order = await createCustomerOrder({ items: [{ menuItemId, quantity: 1 }] }, customerId);

    expect(order.status).toBe('PENDING');
    expect(order.createdById).toBe(customerId);
    expect(order.createdBy.role.name).toBe('RETAIL_USER');
    expect(order.confirmedById).toBeNull();
    expect(order.confirmedAt).toBeNull();

    // The customer can already see who created it (themselves) on their own order.
    const own = await getOrderForCustomer(order.id, customerId);
    expect(own.createdBy.role.name).toBe('RETAIL_USER');
  });

  it('records exactly who accepted/confirmed a customer order when a manager fulfills it', async () => {
    const order = await createCustomerOrder({ items: [{ menuItemId, quantity: 1 }] }, customerId);
    const confirmed = await updateSaleStatus(order.id, 'COMPLETED', managerId);

    expect(confirmed.status).toBe('COMPLETED');
    expect(confirmed.confirmedById).toBe(managerId);
    expect(confirmed.confirmedBy?.role.name).toBe('MANAGER');
    expect(confirmed.confirmedAt).not.toBeNull();
    // Creator is unchanged - still the customer.
    expect(confirmed.createdById).toBe(customerId);
  });

  it('does not touch confirmedBy when a completed order is later cancelled', async () => {
    const order = await createCustomerOrder({ items: [{ menuItemId, quantity: 1 }] }, customerId);
    const confirmed = await updateSaleStatus(order.id, 'COMPLETED', managerId);
    const cancelled = await updateSaleStatus(confirmed.id, 'CANCELLED', staffId);

    expect(cancelled.status).toBe('CANCELLED');
    // Still shows who originally confirmed it - cancelling isn't confirming.
    expect(cancelled.confirmedById).toBe(managerId);
  });
});

import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS } from '../constants/permissions';

describe('role-permission audit', () => {
  it('STAFF keeps exactly the operational permissions their job needs', () => {
    const staff = ROLE_PERMISSIONS.STAFF;
    // Can view assigned stock, record consumption, report wastage, and take/check customer orders.
    for (const required of ['products.read', 'stock.read', 'stock.consume', 'wastage.read', 'wastage.create', 'menu.read', 'sales.read', 'sales.create', 'sales.update']) {
      expect(staff).toContain(required);
    }
  });

  it('STAFF has no supplier, purchase, recipe, or system-administration access', () => {
    const staff = ROLE_PERMISSIONS.STAFF;
    for (const forbidden of [
      'suppliers.read', 'suppliers.create',
      'purchases.read', 'purchases.create', 'purchases.receive',
      'recipes.read', 'recipes.create',
      'users.read', 'users.create',
      'roles.read', 'roles.update',
      'settings.manage',
      'audit_logs.read',
      'reports.read',
      'wastage.approve',
      'stock.adjust', 'stock.transfer',
      'expenses.read', 'expenses.create',
      'production.read', 'production.create', 'production.complete',
    ]) {
      expect(staff).not.toContain(forbidden);
    }
  });

  it('MANAGER keeps day-to-day operational control (including expenses and production) without system-administration/security permissions', () => {
    const manager = ROLE_PERMISSIONS.MANAGER;
    for (const required of [
      'purchases.create', 'purchases.receive', 'stock.adjust', 'stock.transfer', 'stock.consume',
      'wastage.approve', 'recipes.create', 'sales.create', 'reports.read',
      'expenses.read', 'expenses.create',
      'production.read', 'production.create', 'production.complete',
    ]) {
      expect(manager).toContain(required);
    }
    for (const forbidden of ['users.create', 'users.update', 'users.delete', 'roles.read', 'roles.update', 'settings.manage', 'audit_logs.read']) {
      expect(manager).not.toContain(forbidden);
    }
  });

  it('RETAIL_USER (customer) can only place and view their own orders - nothing internal', () => {
    expect(ROLE_PERMISSIONS.RETAIL_USER.sort()).toEqual(['orders.create', 'orders.read']);
  });
});

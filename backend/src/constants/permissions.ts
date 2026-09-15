export const PERMISSIONS = [
  'users.read', 'users.create', 'users.update', 'users.delete',
  'roles.read', 'roles.update',
  'products.read', 'products.create', 'products.update', 'products.delete',
  'categories.read', 'categories.create', 'categories.update', 'categories.delete',
  'units.read', 'units.create', 'units.update', 'units.delete',
  'suppliers.read', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
  'purchases.read', 'purchases.create', 'purchases.update', 'purchases.delete', 'purchases.receive',
  'warehouses.read', 'warehouses.create', 'warehouses.update', 'warehouses.delete',
  'stock.read', 'stock.adjust', 'stock.transfer', 'stock.consume',
  'wastage.read', 'wastage.create', 'wastage.approve',
  'recipes.read', 'recipes.create', 'recipes.update', 'recipes.delete',
  'menu.read', 'menu.create', 'menu.update', 'menu.delete',
  'sales.read', 'sales.create', 'sales.update', 'sales.delete',
  'orders.create', 'orders.read',
  'reports.read',
  'settings.manage',
  'audit_logs.read',
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

// SUPER_ADMIN bypasses this map entirely (see authorize middleware).
export const ROLE_PERMISSIONS: Record<'MANAGER' | 'STAFF' | 'RETAIL_USER', PermissionKey[]> = {
  MANAGER: [
    'products.read', 'products.create', 'products.update', 'products.delete',
    'categories.read', 'categories.create', 'categories.update', 'categories.delete',
    'units.read', 'units.create', 'units.update',
    'suppliers.read', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
    'purchases.read', 'purchases.create', 'purchases.update', 'purchases.receive',
    'warehouses.read',
    'stock.read', 'stock.adjust', 'stock.transfer', 'stock.consume',
    'wastage.read', 'wastage.create', 'wastage.approve',
    'recipes.read', 'recipes.create', 'recipes.update', 'recipes.delete',
    'menu.read', 'menu.create', 'menu.update', 'menu.delete',
    'sales.read', 'sales.create', 'sales.update',
    'reports.read',
    'users.read',
  ],
  STAFF: [
    'products.read',
    'categories.read',
    'units.read',
    'suppliers.read',
    'purchases.read',
    'warehouses.read',
    'stock.read', 'stock.consume',
    'wastage.read', 'wastage.create',
    'recipes.read',
    'menu.read',
    'sales.read', 'sales.create', 'sales.update',
  ],
  RETAIL_USER: [
    'orders.create', 'orders.read',
  ],
};

/**
 * Mirrors the <PermissionRoute permission="..."> wrapping in App.tsx.
 * Used to sanity-check a post-login redirect target before trusting it -
 * otherwise a stale "from" location (e.g. captured before logging out of
 * an admin page) can bounce a lower-privileged user straight to /403.
 */
const ROUTE_PERMISSIONS: Record<string, string> = {
  '/dashboard': 'reports.read',
  '/products': 'products.read',
  '/categories': 'categories.read',
  '/units': 'units.read',
  '/warehouses': 'warehouses.read',
  '/inventory': 'stock.read',
  '/stock-movements': 'stock.read',
  '/suppliers': 'suppliers.read',
  '/purchases': 'purchases.read',
  '/wastage': 'wastage.read',
  '/recipes': 'recipes.read',
  '/menu': 'menu.read',
  '/sales': 'sales.read',
  '/production': 'production.read',
  '/expenses': 'expenses.read',
  '/order': 'orders.create',
  '/orders': 'orders.read',
  '/users': 'users.read',
  '/roles': 'roles.read',
  '/audit-logs': 'audit_logs.read',
  '/reports/inventory': 'reports.read',
  '/reports/purchases': 'reports.read',
  '/reports/sales': 'reports.read',
  '/reports/wastage': 'reports.read',
};

function hasPermission(permissions: string[], permission: string): boolean {
  return permissions.includes('*') || permissions.includes(permission);
}

/** True if this pathname either needs no specific permission, or the user holds it. */
export function isPathAllowed(pathname: string, permissions: string[]): boolean {
  const firstSegment = '/' + (pathname.split('/').filter(Boolean)[0] ?? '');
  const required = ROUTE_PERMISSIONS[pathname] ?? ROUTE_PERMISSIONS[firstSegment];
  return !required || hasPermission(permissions, required);
}

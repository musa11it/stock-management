/** Where to send a user right after login / at the bare "/" route, based on what they can actually see. */
export function getDefaultRoute(permissions: string[]): string {
  const has = (p: string) => permissions.includes('*') || permissions.includes(p);
  if (has('reports.read')) return '/dashboard';
  if (has('orders.create')) return '/order';
  // Staff: no dashboard/report access, not a customer either - land them on their actual
  // day-to-day workspace instead of the bare account-settings page.
  if (has('sales.read')) return '/sales';
  if (has('stock.read')) return '/inventory';
  return '/settings';
}

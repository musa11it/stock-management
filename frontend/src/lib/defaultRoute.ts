/** Where to send a user right after login / at the bare "/" route, based on what they can actually see. */
export function getDefaultRoute(permissions: string[]): string {
  const has = (p: string) => permissions.includes('*') || permissions.includes(p);
  if (has('reports.read')) return '/dashboard';
  if (has('orders.create')) return '/order';
  return '/settings';
}

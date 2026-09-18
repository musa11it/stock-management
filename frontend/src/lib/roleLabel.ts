import type { RoleName } from '@/types';

/** Customer-facing role labels used for order/receipt accountability ("Staff (Name)", "Client (Name)", ...). */
const ROLE_LABELS: Record<RoleName, string> = {
  SUPER_ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Staff',
  RETAIL_USER: 'Client',
};

export function roleLabel(roleName: RoleName): string {
  return ROLE_LABELS[roleName] ?? roleName;
}

/** "Staff (Jane Doe)" - the standard "who did this" display used across orders/receipts. */
export function personLabel(person: { firstName: string; lastName: string; role: { name: RoleName } } | null | undefined): string | null {
  if (!person) return null;
  return `${roleLabel(person.role.name)} (${person.firstName} ${person.lastName})`;
}

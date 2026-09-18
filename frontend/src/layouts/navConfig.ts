import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Package,
  Tags,
  Ruler,
  Warehouse,
  ArrowLeftRight,
  Truck,
  ShoppingCart,
  Trash2,
  ChefHat,
  UtensilsCrossed,
  Receipt,
  Users,
  ShieldCheck,
  BarChart3,
  Settings,
  ClipboardList,
  Wallet,
  Factory,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  permission?: string;
  /** Restricts visibility to these roles regardless of permission (SUPER_ADMIN always passes). Use when a page is self-scoped rather than permission-gated. */
  roles?: string[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, permission: 'reports.read' }],
  },
  {
    title: 'Order',
    items: [
      { label: 'Order Food', to: '/order', icon: UtensilsCrossed, permission: 'orders.create' },
      { label: 'My Orders', to: '/orders', icon: Receipt, permission: 'orders.read' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { label: 'Products', to: '/products', icon: Package, permission: 'products.read' },
      { label: 'Categories', to: '/categories', icon: Tags, permission: 'categories.read' },
      { label: 'Units', to: '/units', icon: Ruler, permission: 'units.read' },
      { label: 'Warehouses', to: '/warehouses', icon: Warehouse, permission: 'warehouses.read' },
      { label: 'Inventory', to: '/inventory', icon: ClipboardList, permission: 'stock.read' },
      { label: 'Stock Movements', to: '/stock-movements', icon: ArrowLeftRight, permission: 'stock.read' },
    ],
  },
  {
    title: 'Purchasing',
    items: [
      { label: 'Suppliers', to: '/suppliers', icon: Truck, permission: 'suppliers.read' },
      { label: 'Purchases', to: '/purchases', icon: ShoppingCart, permission: 'purchases.read' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Wastage', to: '/wastage', icon: Trash2, permission: 'wastage.read' },
      { label: 'Recipes', to: '/recipes', icon: ChefHat, permission: 'recipes.read' },
      { label: 'Menu', to: '/menu', icon: UtensilsCrossed, permission: 'menu.read' },
      { label: 'Sales', to: '/sales', icon: Receipt, permission: 'sales.read' },
      { label: 'Production', to: '/production', icon: Factory, permission: 'production.read' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Expenses', to: '/expenses', icon: Wallet, permission: 'expenses.read' },
      { label: 'My Payments', to: '/my-payments', icon: Receipt, roles: ['STAFF', 'MANAGER'] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Users', to: '/users', icon: Users, permission: 'users.read' },
      { label: 'Roles & Permissions', to: '/roles', icon: ShieldCheck, permission: 'roles.read' },
      { label: 'Audit Logs', to: '/audit-logs', icon: ClipboardList, permission: 'audit_logs.read' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Reports', to: '/reports/inventory', icon: BarChart3, permission: 'reports.read' },
      { label: 'Settings', to: '/settings', icon: Settings },
    ],
  },
];

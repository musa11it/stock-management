import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { PermissionRoute } from '@/routes/PermissionRoute';
import { PageSpinner } from '@/components/ui/Spinner';

const LandingPage = lazy(() => import('@/pages/public/LandingPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));

const OrderPage = lazy(() => import('@/pages/order/OrderPage'));
const MyOrdersPage = lazy(() => import('@/pages/order/MyOrdersPage'));
const OrderDetailPage = lazy(() => import('@/pages/order/OrderDetailPage'));

const ProductsPage = lazy(() => import('@/pages/products/ProductsPage'));
const CategoriesPage = lazy(() => import('@/pages/categories/CategoriesPage'));
const UnitsPage = lazy(() => import('@/pages/units/UnitsPage'));
const WarehousesPage = lazy(() => import('@/pages/warehouses/WarehousesPage'));
const InventoryPage = lazy(() => import('@/pages/inventory/InventoryPage'));
const StockMovementsPage = lazy(() => import('@/pages/stock-movements/StockMovementsPage'));

const SuppliersPage = lazy(() => import('@/pages/suppliers/SuppliersPage'));
const PurchasesPage = lazy(() => import('@/pages/purchases/PurchasesPage'));
const PurchaseDetailPage = lazy(() => import('@/pages/purchases/PurchaseDetailPage'));

const WastagePage = lazy(() => import('@/pages/wastage/WastagePage'));
const RecipesPage = lazy(() => import('@/pages/recipes/RecipesPage'));
const MenuPage = lazy(() => import('@/pages/menu/MenuPage'));
const SalesPage = lazy(() => import('@/pages/sales/SalesPage'));
const ProductionPage = lazy(() => import('@/pages/production/ProductionPage'));

const ExpensesPage = lazy(() => import('@/pages/expenses/ExpensesPage'));
const MyPaymentsPage = lazy(() => import('@/pages/expenses/MyPaymentsPage'));

const UsersPage = lazy(() => import('@/pages/users/UsersPage'));
const RolesPage = lazy(() => import('@/pages/roles/RolesPage'));
const AuditLogsPage = lazy(() => import('@/pages/audit-logs/AuditLogsPage'));

const InventoryReportPage = lazy(() => import('@/pages/reports/InventoryReportPage'));
const PurchasesReportPage = lazy(() => import('@/pages/reports/PurchasesReportPage'));
const SalesReportPage = lazy(() => import('@/pages/reports/SalesReportPage'));
const WastageReportPage = lazy(() => import('@/pages/reports/WastageReportPage'));

const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));

const NotFoundPage = lazy(() => import('@/pages/errors/NotFoundPage'));
const ForbiddenPage = lazy(() => import('@/pages/errors/ForbiddenPage'));

function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route path="/403" element={<ForbiddenPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route element={<PermissionRoute permission="reports.read" />}>
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>

            <Route element={<PermissionRoute permission="orders.create" />}>
              <Route path="/order" element={<OrderPage />} />
            </Route>
            <Route element={<PermissionRoute permission="orders.read" />}>
              <Route path="/orders" element={<MyOrdersPage />} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />
            </Route>

            <Route element={<PermissionRoute permission="products.read" />}>
              <Route path="/products" element={<ProductsPage />} />
            </Route>
            <Route element={<PermissionRoute permission="categories.read" />}>
              <Route path="/categories" element={<CategoriesPage />} />
            </Route>
            <Route element={<PermissionRoute permission="units.read" />}>
              <Route path="/units" element={<UnitsPage />} />
            </Route>
            <Route element={<PermissionRoute permission="warehouses.read" />}>
              <Route path="/warehouses" element={<WarehousesPage />} />
            </Route>
            <Route element={<PermissionRoute permission="stock.read" />}>
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/stock-movements" element={<StockMovementsPage />} />
            </Route>

            <Route element={<PermissionRoute permission="suppliers.read" />}>
              <Route path="/suppliers" element={<SuppliersPage />} />
            </Route>
            <Route element={<PermissionRoute permission="purchases.read" />}>
              <Route path="/purchases" element={<PurchasesPage />} />
              <Route path="/purchases/:id" element={<PurchaseDetailPage />} />
            </Route>

            <Route element={<PermissionRoute permission="wastage.read" />}>
              <Route path="/wastage" element={<WastagePage />} />
            </Route>
            <Route element={<PermissionRoute permission="recipes.read" />}>
              <Route path="/recipes" element={<RecipesPage />} />
            </Route>
            <Route element={<PermissionRoute permission="menu.read" />}>
              <Route path="/menu" element={<MenuPage />} />
            </Route>
            <Route element={<PermissionRoute permission="sales.read" />}>
              <Route path="/sales" element={<SalesPage />} />
            </Route>
            <Route element={<PermissionRoute permission="production.read" />}>
              <Route path="/production" element={<ProductionPage />} />
            </Route>

            <Route element={<PermissionRoute permission="expenses.read" />}>
              <Route path="/expenses" element={<ExpensesPage />} />
            </Route>
            <Route element={<PermissionRoute roles={['STAFF', 'MANAGER']} />}>
              <Route path="/my-payments" element={<MyPaymentsPage />} />
            </Route>

            <Route element={<PermissionRoute permission="users.read" />}>
              <Route path="/users" element={<UsersPage />} />
            </Route>
            <Route element={<PermissionRoute permission="roles.read" />}>
              <Route path="/roles" element={<RolesPage />} />
            </Route>
            <Route element={<PermissionRoute permission="audit_logs.read" />}>
              <Route path="/audit-logs" element={<AuditLogsPage />} />
            </Route>

            <Route element={<PermissionRoute permission="reports.read" />}>
              <Route path="/reports/inventory" element={<InventoryReportPage />} />
              <Route path="/reports/purchases" element={<PurchasesReportPage />} />
              <Route path="/reports/sales" element={<SalesReportPage />} />
              <Route path="/reports/wastage" element={<WastageReportPage />} />
            </Route>

            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default App;



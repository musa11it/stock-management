import { Outlet } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Restaurant Stock Manager</h1>
          <p className="mt-1 text-sm text-slate-500">Inventory that never lies about what's in the kitchen</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

import { Navigate, Link } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getDefaultRoute } from '@/lib/defaultRoute';
import { Button } from '@/components/ui/Button';
import { MenuBrowser } from '@/components/ordering/MenuBrowser';

export default function LandingPage() {
  const { isAuthenticated, isLoading: authLoading, permissions } = useAuth();

  // Already signed in? Send them straight into the app instead of the public menu.
  if (!authLoading && isAuthenticated) {
    return <Navigate to={getDefaultRoute(permissions)} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <span className="text-base font-semibold text-slate-900">Restaurant Stock</span>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Our Menu</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500 sm:text-base">
            Fresh dishes made to order. Add what you like, then sign in to place your order and track it.
          </p>
        </div>

        <MenuBrowser />
      </section>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        Restaurant Stock Management System
      </footer>
    </div>
  );
}

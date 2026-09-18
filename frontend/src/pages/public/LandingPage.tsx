import { Navigate, Link } from 'react-router-dom';
import { UtensilsCrossed, Sparkles, Clock3, Leaf } from 'lucide-react';
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

      <section className="relative overflow-hidden bg-slate-900">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '22px 22px' }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-100 ring-1 ring-inset ring-white/20">
            <Sparkles className="h-3.5 w-3.5" /> Fresh, made to order
          </span>
          <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Great food, honestly made.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-300 sm:text-lg">
            Browse today's menu, build your order, and track it in real time - straight from our kitchen to your table.
          </p>

          <div className="mx-auto mt-8 flex max-w-xl flex-col justify-center gap-3 text-sm text-slate-300 sm:flex-row sm:gap-8">
            <div className="flex items-center justify-center gap-2">
              <Leaf className="h-4 w-4 text-emerald-400" /> Made with quality ingredients
            </div>
            <div className="flex items-center justify-center gap-2">
              <Clock3 className="h-4 w-4 text-brand-400" /> Prepared fresh on order
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Our Menu</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500 sm:text-base">
            Add what you like, then sign in to place your order and track it.
          </p>
        </div>

        <MenuBrowser />
      </section>

      <footer className="border-t border-slate-200 bg-white py-8 text-center">
        <p className="flex items-center justify-center gap-2 text-sm font-medium text-slate-700">
          <UtensilsCrossed className="h-4 w-4 text-brand-600" /> Restaurant Stock
        </p>
        <p className="mt-1 text-xs text-slate-400">Restaurant Stock Management System</p>
      </footer>
    </div>
  );
}

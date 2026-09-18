import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Search, ShoppingCart, Plus, Minus, Trash2, UtensilsCrossed, X, ChevronDown, ChevronUp, Wheat, CircleCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { fetchPublicMenu, type PublicMenuItem } from '@/services/publicMenu.service';
import { placeOrder } from '@/services/order.service';
import { getErrorMessage } from '@/lib/apiClient';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

function categorySlug(category: string): string {
  return `menu-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
}

export function MenuBrowser() {
  const { isAuthenticated, hasPermission } = useAuth();
  const navigate = useNavigate();
  const cart = useCart();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const { data: items, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['public-menu', debouncedSearch],
    queryFn: () => fetchPublicMenu(debouncedSearch || undefined),
  });

  const grouped = useMemo(() => {
    const groups = new Map<string, PublicMenuItem[]>();
    for (const item of items ?? []) {
      const key = item.category?.trim() || 'Other';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries());
  }, [items]);

  const canOrder = isAuthenticated && hasPermission('orders.create');

  const placeOrderMutation = useMutation({
    mutationFn: () => placeOrder({ items: cart.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })) }),
    onSuccess: (order) => {
      toast.success('Order placed! We\'re on it.');
      cart.clear();
      setIsCartOpen(false);
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      navigate(`/orders/${order.id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleCheckout = () => {
    if (!canOrder) {
      navigate('/login');
      return;
    }
    placeOrderMutation.mutate();
  };

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 mb-8 border-b border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5 sm:shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search the menu..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {cart.totalItems > 0 && (
            <Button onClick={() => setIsCartOpen(true)} className="shrink-0">
              <ShoppingCart className="h-4 w-4" />
              View order ({cart.totalItems}) · {cart.totalPrice.toLocaleString()}
            </Button>
          )}
        </div>

        {grouped.length > 1 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {grouped.map(([category, categoryItems]) => (
              <a
                key={category}
                href={`#${categorySlug(category)}`}
                className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                {category} <span className="text-slate-400">· {categoryItems.length}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-40 w-full" />
              <div className="p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-4 h-9 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : !items || items.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="No menu items available right now" description="Please check back soon." />
      ) : (
        <div className="space-y-12">
          {grouped.map(([category, categoryItems]) => (
            <div key={category} id={categorySlug(category)} className="scroll-mt-40">
              <div className="mb-5 flex items-baseline gap-2.5">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">{category}</h2>
                <span className="text-sm text-slate-400">{categoryItems.length} item{categoryItems.length === 1 ? '' : 's'}</span>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {categoryItems.map((item) => (
                  <MenuItemCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        title="Your order"
        footer={
          cart.items.length > 0 ? (
            <>
              <Button variant="outline" onClick={() => setIsCartOpen(false)}>
                Keep browsing
              </Button>
              <Button onClick={handleCheckout} isLoading={placeOrderMutation.isPending}>
                {canOrder ? `Place order · ${cart.totalPrice.toLocaleString()}` : 'Sign in to order'}
              </Button>
            </>
          ) : undefined
        }
      >
        {cart.items.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Your order is empty" description="Add items from the menu to get started." />
        ) : (
          <div className="space-y-3">
            {cart.items.map((item) => (
              <div key={item.menuItemId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.price.toLocaleString()} each</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => cart.setQuantity(item.menuItemId, item.quantity - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => cart.setQuantity(item.menuItemId, item.quantity + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => cart.removeItem(item.menuItemId)} className="ml-1 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-semibold text-slate-900">
              <span>Total</span>
              <span>{cart.totalPrice.toLocaleString()}</span>
            </div>
            {!canOrder && <p className="text-xs text-slate-500">You'll be asked to sign in before your order is submitted.</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

function MenuItemCard({ item }: { item: PublicMenuItem }) {
  const cart = useCart();
  const inCart = cart.items.find((i) => i.menuItemId === item.id);
  const [showIngredients, setShowIngredients] = useState(false);
  const ingredients = item.recipe?.ingredients ?? [];

  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative h-40 w-full shrink-0 overflow-hidden bg-gradient-to-br from-brand-50 to-slate-100">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UtensilsCrossed className="h-10 w-10 text-brand-200" strokeWidth={1.5} />
          </div>
        )}
        <span className="absolute right-3 top-3 rounded-full bg-white px-2.5 py-1 text-sm font-semibold text-brand-700 shadow-sm ring-1 ring-black/5">
          {Number(item.price).toLocaleString()}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-900">{item.name}</h3>
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-600">
          <CircleCheck className="h-3.5 w-3.5" /> Available
        </p>
        {item.description ? (
          <p className="mt-2 line-clamp-3 flex-1 text-sm text-slate-500">{item.description}</p>
        ) : (
          <div className="flex-1" />
        )}

        {ingredients.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowIngredients((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              <Wheat className="h-3.5 w-3.5" />
              {showIngredients ? 'Hide ingredients' : "What's in it?"}
              {showIngredients ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showIngredients && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ingredients.map((ing, i) => (
                  <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {ing.product.name} · {Number(ing.quantity)}
                    {ing.product.unit.abbreviation}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          {!inCart ? (
            <Button
              size="sm"
              className="w-full"
              onClick={() => cart.addItem({ menuItemId: item.id, name: item.name, price: Number(item.price) })}
            >
              <Plus className="h-4 w-4" /> Add to order
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 p-1">
              <button
                onClick={() => cart.setQuantity(item.id, inCart.quantity - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
              >
                {inCart.quantity === 1 ? <X className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              </button>
              <span className="w-8 text-center text-sm font-semibold text-slate-900">{inCart.quantity}</span>
              <button
                onClick={() => cart.setQuantity(item.id, inCart.quantity + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

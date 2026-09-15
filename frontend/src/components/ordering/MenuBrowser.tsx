import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Search, ShoppingCart, Plus, Minus, Trash2, UtensilsCrossed, X, ChevronDown, ChevronUp, Wheat } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { fetchPublicMenu, type PublicMenuItem } from '@/services/publicMenu.service';
import { placeOrder } from '@/services/order.service';
import { getErrorMessage } from '@/lib/apiClient';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

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
      const key = item.category ?? 'Other';
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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search the menu..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {cart.totalItems > 0 && (
          <Button variant="outline" onClick={() => setIsCartOpen(true)} className="shrink-0">
            <ShoppingCart className="h-4 w-4" />
            View order ({cart.totalItems}) · {cart.totalPrice.toLocaleString()}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-4 h-9 w-full" />
            </Card>
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : !items || items.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="No menu items available right now" description="Please check back soon." />
      ) : (
        <div className="space-y-10">
          {grouped.map(([category, categoryItems]) => (
            <div key={category}>
              <h2 className="mb-4 text-lg font-semibold text-slate-900">{category}</h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
    <Card className="flex flex-col p-5">
      {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="mb-3 h-40 w-full rounded-lg object-cover" />}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-slate-900">{item.name}</h3>
        <Badge tone="blue">{Number(item.price).toLocaleString()}</Badge>
      </div>
      {item.description && <p className="mt-2 flex-1 text-sm text-slate-500">{item.description}</p>}

      {ingredients.length > 0 && (
        <div className="mt-2">
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
    </Card>
  );
}

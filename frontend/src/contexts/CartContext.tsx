import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

const CART_STORAGE_KEY = 'rsm_cart';

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: { menuItemId: string; name: string; price: number }, quantity?: number) => void;
  removeItem: (menuItemId: string) => void;
  setQuantity: (menuItemId: string, quantity: number) => void;
  clear: () => void;
  totalItems: number;
  totalPrice: number;
}

// eslint-disable-next-line react-refresh/only-export-components
export const CartContext = createContext<CartContextValue | undefined>(undefined);

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readCart());

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: { menuItemId: string; name: string; price: number }, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.menuItemId);
      if (existing) {
        return prev.map((i) => (i.menuItemId === item.menuItemId ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [...prev, { ...item, quantity }];
    });
  }, []);

  const removeItem = useCallback((menuItemId: string) => {
    setItems((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  }, []);

  const setQuantity = useCallback((menuItemId: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.menuItemId !== menuItemId);
      return prev.map((i) => (i.menuItemId === menuItemId ? { ...i, quantity } : i));
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const totalPrice = useMemo(() => items.reduce((sum, i) => sum + i.quantity * i.price, 0), [items]);

  const value = useMemo(
    () => ({ items, addItem, removeItem, setQuantity, clear, totalItems, totalPrice }),
    [items, addItem, removeItem, setQuantity, clear, totalItems, totalPrice],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

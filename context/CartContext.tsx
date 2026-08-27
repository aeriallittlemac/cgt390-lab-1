"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { CartItem } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/storage";
import { createLocalStore, useStore } from "@/lib/clientStore";

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, "id">) => void;
  updateQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const cartStore = createLocalStore<CartItem[]>(STORAGE_KEYS.cart, []);

function makeId(): string {
  return `ci_${Math.random().toString(36).slice(2, 10)}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = useStore(cartStore);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const addItem = useCallback((item: Omit<CartItem, "id">) => {
    cartStore.set([...cartStore.getSnapshot(), { ...item, id: makeId() }]);
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    cartStore.set(
      cartStore
        .getSnapshot()
        .map((it) => (it.id === id ? { ...it, qty: Math.max(0, qty) } : it))
        .filter((it) => it.qty > 0),
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    cartStore.set(cartStore.getSnapshot().filter((it) => it.id !== id));
  }, []);

  const clear = useCallback(() => cartStore.set([]), []);

  const itemCount = useMemo(
    () => items.reduce((n, it) => n + it.qty, 0),
    [items],
  );
  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount,
      subtotal,
      isCartOpen,
      openCart,
      closeCart,
      addItem,
      updateQty,
      removeItem,
      clear,
    }),
    [
      items,
      itemCount,
      subtotal,
      isCartOpen,
      openCart,
      closeCart,
      addItem,
      updateQty,
      removeItem,
      clear,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a <CartProvider>");
  return ctx;
}

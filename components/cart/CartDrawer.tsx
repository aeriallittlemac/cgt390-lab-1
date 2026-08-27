"use client";

import { useRouter } from "next/navigation";
import { Drawer } from "@/components/common/Drawer";
import { useCart } from "@/context/CartContext";
import { useLocation } from "@/context/LocationContext";
import { CartLineItem } from "./CartLineItem";
import { CartSummary } from "./CartSummary";

export function CartDrawer() {
  const router = useRouter();
  const { items, subtotal, isCartOpen, closeCart, updateQty, removeItem } =
    useCart();
  const { selectedLocation, open: openLocation } = useLocation();

  function handleCheckout() {
    closeCart();
    if (!selectedLocation) {
      openLocation({ orderIntent: true });
      return;
    }
    router.push("/order");
  }

  return (
    <Drawer open={isCartOpen} onClose={closeCart} side="right" title="Your cart">
      {items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
          <span aria-hidden="true" className="text-3xl">🛒</span>
          <p className="font-medium">Your cart is empty</p>
          <p className="text-sm text-zinc-500">
            Add something from the menu to get started.
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-zinc-100 px-4 dark:divide-zinc-800">
            {items.map((item) => (
              <CartLineItem
                key={item.id}
                item={item}
                onQty={(qty) => updateQty(item.id, qty)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </ul>
          <div className="space-y-4 p-4">
            <CartSummary subtotal={subtotal} />
            <button
              type="button"
              onClick={handleCheckout}
              className="w-full rounded-full bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700"
            >
              Checkout
            </button>
          </div>
        </>
      )}
    </Drawer>
  );
}

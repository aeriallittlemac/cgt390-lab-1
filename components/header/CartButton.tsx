"use client";

import { useCart } from "@/context/CartContext";
import { Badge } from "@/components/common/Badge";

export function CartButton() {
  const { itemCount, openCart } = useCart();

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={`Open cart${itemCount ? `, ${itemCount} items` : ""}`}
      className="relative rounded-full p-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.8h7.7a2 2 0 0 0 2-1.6L22 8H6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="21" r="1.4" fill="currentColor" />
        <circle cx="18" cy="21" r="1.4" fill="currentColor" />
      </svg>
      {itemCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5">
          <Badge>{itemCount}</Badge>
        </span>
      )}
    </button>
  );
}

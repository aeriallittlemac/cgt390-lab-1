"use client";

import type { CartItem } from "@/lib/types";
import { formatPrice } from "@/components/common/Price";

export function CartLineItem({
  item,
  onQty,
  onRemove,
}: {
  item: CartItem;
  onQty: (qty: number) => void;
  onRemove: () => void;
}) {
  const detail = [item.size, item.crust, ...item.toppings]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex gap-3 py-3">
      <div className="flex-1">
        <p className="font-medium">{item.name}</p>
        {detail && <p className="text-xs text-zinc-500">{detail}</p>}
        <div className="mt-2 inline-flex items-center rounded-full border border-zinc-300 dark:border-zinc-700">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => onQty(item.qty - 1)}
            className="px-2.5 py-1 text-sm"
          >
            −
          </button>
          <span className="min-w-6 text-center text-sm">{item.qty}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => onQty(item.qty + 1)}
            className="px-2.5 py-1 text-sm"
          >
            +
          </button>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold">
          {formatPrice(item.unitPrice * item.qty)}
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="mt-2 text-xs text-zinc-500 hover:text-red-600 hover:underline"
        >
          Remove
        </button>
      </div>
    </li>
  );
}

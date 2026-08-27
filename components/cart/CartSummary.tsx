"use client";

import { formatPrice } from "@/components/common/Price";

export function CartSummary({ subtotal }: { subtotal: number }) {
  // Flat mock fee/tax for the scaffold; real pricing comes with checkout.
  const deliveryFee = subtotal > 0 ? 2.99 : 0;
  const tax = +(subtotal * 0.1025).toFixed(2);
  const total = subtotal + deliveryFee + tax;

  const rows = [
    ["Subtotal", subtotal],
    ["Delivery fee", deliveryFee],
    ["Estimated tax", tax],
  ] as const;

  return (
    <div className="space-y-1 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between text-zinc-500">
          <span>{label}</span>
          <span>{formatPrice(value)}</span>
        </div>
      ))}
      <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold dark:border-zinc-800">
        <span>Total</span>
        <span>{formatPrice(total)}</span>
      </div>
    </div>
  );
}

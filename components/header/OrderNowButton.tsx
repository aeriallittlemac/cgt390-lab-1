"use client";

import { useLocation } from "@/context/LocationContext";

/**
 * "Order Now" CTA. Not a link — it opens the location drawer with order intent,
 * so confirming an address routes the user to /order. See PLAN.md decision 4.
 */
export function OrderNowButton({ className }: { className?: string }) {
  const { open } = useLocation();
  return (
    <button
      type="button"
      onClick={() => open({ orderIntent: true })}
      className={
        className ??
        "inline-flex h-11 items-center rounded-full bg-red-600 px-6 text-sm font-semibold text-white hover:bg-red-700"
      }
    >
      Order Now
    </button>
  );
}

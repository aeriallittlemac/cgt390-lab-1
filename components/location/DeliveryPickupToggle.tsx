"use client";

import type { ServiceMode } from "@/lib/types";

export function DeliveryPickupToggle({
  value,
  onChange,
}: {
  value: ServiceMode;
  onChange: (mode: ServiceMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Order type"
      className="grid grid-cols-2 gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-800"
    >
      {(["delivery", "pickup"] as const).map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(mode)}
            className={`rounded-full py-2 text-sm font-semibold capitalize transition-colors ${
              active
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {mode}
          </button>
        );
      })}
    </div>
  );
}

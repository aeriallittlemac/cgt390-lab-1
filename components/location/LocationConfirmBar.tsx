"use client";

import type { ServiceMode } from "@/lib/types";

export function LocationConfirmBar({
  mode,
  disabled,
  onConfirm,
}: {
  mode: ServiceMode;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
      <button
        type="button"
        disabled={disabled}
        onClick={onConfirm}
        className="w-full rounded-full bg-red-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mode === "delivery" ? "Deliver here" : "Pick up here"}
      </button>
      {disabled && (
        <p className="mt-2 text-center text-xs text-zinc-500">
          Choose an address and a store to continue.
        </p>
      )}
    </div>
  );
}

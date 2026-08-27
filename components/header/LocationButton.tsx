"use client";

import { useLocation } from "@/context/LocationContext";

export function LocationButton() {
  const { open, selectedLocation, mode } = useLocation();

  const label = selectedLocation
    ? `${mode === "delivery" ? "Deliver to" : "Pick up at"}: ${truncate(
        selectedLocation.label,
      )}`
    : "Choose Your Location";

  return (
    <button
      type="button"
      onClick={() => open()}
      className="flex items-center gap-2 rounded-full border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.2 4.5 8.5 4.5 8.5s4.5-5.3 4.5-8.5A4.5 4.5 0 0 0 8 1.5Zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"
          fill="currentColor"
        />
      </svg>
      <span className="max-w-[220px] truncate">{label}</span>
    </button>
  );
}

function truncate(s: string, n = 28): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

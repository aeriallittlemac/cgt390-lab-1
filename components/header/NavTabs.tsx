"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocation } from "@/context/LocationContext";

/** Left-group tabs. "Order Now" is not a route — it opens the location drawer. */
const ROUTES = [
  { href: "/menu", label: "Menu" },
  { href: "/deals", label: "Deals" },
  { href: "/rewards", label: "My Rewards" },
  { href: "/tracker", label: "Tracker" },
] as const;

export function NavTabs({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { open } = useLocation();

  return (
    <nav className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-1">
      <button
        type="button"
        onClick={() => {
          open({ orderIntent: true });
          onNavigate?.();
        }}
        className="rounded-full px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 sm:text-center dark:hover:bg-red-950/40"
      >
        Order Now
      </button>
      {ROUTES.map((r) => {
        const active = pathname === r.href;
        return (
          <Link
            key={r.href}
            href={r.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {r.label}
          </Link>
        );
      })}
    </nav>
  );
}

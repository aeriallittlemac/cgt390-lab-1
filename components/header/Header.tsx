"use client";

import { useState } from "react";
import Link from "next/link";
import { NavTabs } from "./NavTabs";
import { LocationButton } from "./LocationButton";
import { AuthButton } from "./AuthButton";
import { CartButton } from "./CartButton";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span aria-hidden="true" className="text-xl">🍕</span>
          <span>Slice Society</span>
        </Link>

        {/* Left group — desktop */}
        <div className="hidden sm:block">
          <NavTabs />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Right group — desktop */}
          <div className="hidden items-center gap-2 sm:flex">
            <LocationButton />
            <AuthButton />
          </div>
          <CartButton />

          {/* Mobile toggle */}
          <button
            type="button"
            className="rounded-full p-2 text-zinc-700 hover:bg-zinc-100 sm:hidden dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div className="border-t border-zinc-200 px-4 py-3 sm:hidden dark:border-zinc-800">
          <NavTabs onNavigate={() => setMobileOpen(false)} />
          <div className="mt-3 flex flex-col gap-2">
            <LocationButton />
            <AuthButton />
          </div>
        </div>
      )}
    </header>
  );
}

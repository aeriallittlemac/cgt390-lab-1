"use client";

import { useState } from "react";

/**
 * Stub. Real auth (NextAuth) is a later phase — see PLAN.md section 11.
 * For now this just shows a "coming soon" popover.
 */
export function AuthButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-full px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Sign In
      </button>
      {open && (
        <div
          role="dialog"
          className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-zinc-200 bg-white p-4 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="font-medium">Accounts are coming soon</p>
          <p className="mt-1 text-zinc-500">
            Sign-in and saved orders aren&apos;t wired up in this build yet.
          </p>
        </div>
      )}
    </div>
  );
}

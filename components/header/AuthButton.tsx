"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/types";

const buttonClass =
  "rounded-full px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";

/**
 * Signed out: a link to the login page that returns here afterwards.
 * Signed in: the user's name, opening a menu with My account and Sign out.
 * Receives the user from the server (see AuthMenu); it never decides access itself.
 */
export function AuthButton({ user }: { user: Pick<PublicUser, "name" | "role"> | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) {
    const next = pathname === "/login" || pathname === "/signup" ? "/account" : pathname;
    return (
      <Link href={`/login?next=${encodeURIComponent(next)}`} className={buttonClass}>
        Sign In
      </Link>
    );
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setOpen(false);
      setSigningOut(false);
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={menuId}
        className={buttonClass}
      >
        Hi, {user.name.split(" ")[0]}
        {user.role === "staff" && <span className="ml-1 text-xs text-zinc-600 dark:text-zinc-400">(staff)</span>}
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-zinc-200 bg-white p-2 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            My account
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="block w-full rounded-lg px-3 py-2 text-left hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

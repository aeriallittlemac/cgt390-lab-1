import type { Metadata } from "next";
import { AuthButton } from "@/components/header/AuthButton";

export const metadata: Metadata = { title: "My Rewards — Slice Society" };

/**
 * Stubbed. Real rewards need auth (PLAN.md section 11). For now this shows the
 * signed-out state only.
 */
export default function RewardsPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <span aria-hidden="true" className="text-5xl">⭐</span>
      <h1 className="mt-4 text-2xl font-bold">My Rewards</h1>
      <p className="mt-2 text-zinc-500">
        Sign in to see your points balance, tier, and reward history. Accounts
        aren&apos;t wired up in this build yet.
      </p>
      <div className="mt-6 flex justify-center">
        <AuthButton />
      </div>
    </div>
  );
}

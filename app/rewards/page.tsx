import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";

export const metadata: Metadata = { title: "My Rewards — Slice Society" };

/** Members only. Points aren't tracked yet, so this shows a placeholder for the signed-in user. */
export default async function RewardsPage() {
  const user = await requireUser("/rewards");

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <span aria-hidden="true" className="text-5xl">⭐</span>
      <h1 className="mt-4 text-2xl font-bold">My Rewards</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Hi {user.name}. Points, tiers, and reward history are coming soon.
      </p>
    </div>
  );
}

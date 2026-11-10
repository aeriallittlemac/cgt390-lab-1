import type { Metadata } from "next";
import Link from "next/link";
import storesData from "@/data/stores.json";
import { requireUser } from "@/lib/dal";
import { listOrdersFor, nextStatus } from "@/lib/orderStore";
import type { Store } from "@/lib/types";
import { formatPrice } from "@/components/common/Price";
import { AdvanceStatusButton } from "@/components/account/AdvanceStatusButton";

export const metadata: Metadata = { title: "My account — Slice Society" };

const storeName = new Map((storesData as Store[]).map((s) => [s.id, s.name]));

export default async function AccountPage() {
  const user = await requireUser("/account");
  const orders = await listOrdersFor(user);
  const isStaff = user.role === "staff";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">My account</h1>
      <section className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="font-semibold">{user.name}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{user.email}</p>
        {isStaff && <p className="mt-1 text-xs font-semibold text-red-700 dark:text-red-400">Staff account</p>}
      </section>

      <h2 className="mt-10 mb-3 text-lg font-semibold">{isStaff ? "All orders" : "Your orders"}</h2>
      {orders.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No orders yet.{" "}
          <Link href="/menu" className="text-red-600 hover:underline">
            Browse the menu.
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {orders.map((o) => {
            const next = nextStatus(o.mode, o.status);
            return (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <Link href={`/tracker?id=${o.id}`} className="font-mono font-semibold hover:underline">
                    {o.id}
                  </Link>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {new Date(o.placedAt).toLocaleString()} · {o.mode} ·{" "}
                    {storeName.get(o.storeId) ?? o.storeId}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">{o.status}</span>
                  <span className="font-semibold">{formatPrice(o.subtotal)}</span>
                  {isStaff && next && <AdvanceStatusButton orderId={o.id} to={next} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocation } from "@/context/LocationContext";
import { useCart } from "@/context/CartContext";
import { useHydrated } from "@/lib/clientStore";
import { formatPrice } from "@/components/common/Price";

export default function OrderPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { selectedLocation, open } = useLocation();
  const { items, subtotal, clear } = useCart();
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Route guard: no confirmed location -> bounce home and open the drawer.
  useEffect(() => {
    if (hydrated && !selectedLocation && !orderId) {
      open({ orderIntent: true });
      router.replace("/");
    }
  }, [hydrated, selectedLocation, orderId, open, router]);

  if (!hydrated) {
    return <p className="mx-auto max-w-2xl px-4 py-12 text-zinc-500">Loading…</p>;
  }

  if (!selectedLocation) return null; // guard effect is redirecting

  async function placeOrder() {
    setPlacing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: selectedLocation!.mode,
          storeId: selectedLocation!.storeId,
          items,
        }),
      });
      const data = (await res.json()) as { id: string };
      setOrderId(data.id);
      clear();
    } finally {
      setPlacing(false);
    }
  }

  if (orderId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <span aria-hidden="true" className="text-5xl">✅</span>
        <h1 className="mt-4 text-2xl font-bold">Order placed</h1>
        <p className="mt-2 text-zinc-500">
          Your order number is <span className="font-mono font-semibold">{orderId}</span>.
        </p>
        <Link
          href={`/tracker`}
          className="mt-6 inline-flex h-11 items-center rounded-full bg-red-600 px-6 text-sm font-semibold text-white hover:bg-red-700"
        >
          Track this order
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">Review your order</h1>

      <section className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-500">
          {selectedLocation.mode === "delivery" ? "Deliver to" : "Pick up at"}
        </h2>
        <p className="mt-1">{selectedLocation.label}</p>
        <button
          type="button"
          onClick={() => open()}
          className="mt-2 text-sm font-medium text-red-600 hover:underline"
        >
          Change
        </button>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold">Items</h2>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Your cart is empty.{" "}
            <Link href="/menu" className="text-red-600 hover:underline">
              Add something from the menu.
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {items.map((it) => (
              <li key={it.id} className="flex justify-between px-4 py-3 text-sm">
                <span>
                  {it.qty}× {it.name}
                  {it.size ? ` (${it.size})` : ""}
                </span>
                <span>{formatPrice(it.unitPrice * it.qty)}</span>
              </li>
            ))}
            <li className="flex justify-between px-4 py-3 font-semibold">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </li>
          </ul>
        )}
      </section>

      <button
        type="button"
        disabled={items.length === 0 || placing}
        onClick={placeOrder}
        className="mt-8 w-full rounded-full bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
      >
        {placing ? "Placing order…" : "Place order"}
      </button>
      <p className="mt-2 text-center text-xs text-zinc-400">
        No payment is taken — this is a scaffold build.
      </p>
    </div>
  );
}

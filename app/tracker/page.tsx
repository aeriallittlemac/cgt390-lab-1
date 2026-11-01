import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";
import { getOrderFor, statusSteps } from "@/lib/orderStore";
import type { OrderStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Track your order — Slice Society" };

const LABELS: Record<OrderStatus, string> = {
  received: "Order received",
  making: "Making your pizza",
  baking: "In the oven",
  ready: "Ready",
  out: "Out for delivery",
  delivered: "Delivered",
};

export default async function TrackerPage({ searchParams }: PageProps<"/tracker">) {
  const { id: rawId } = await searchParams;
  const id = typeof rawId === "string" ? rawId.trim() : "";
  const user = await requireUser(id ? `/tracker?id=${encodeURIComponent(id)}` : "/tracker");

  // Same lookup the API uses: other customers' orders are "not found".
  const order = id ? getOrderFor(user, id) : null;
  const steps = order ? statusSteps(order.mode) : [];
  const current = order ? steps.indexOf(order.status) : -1;

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-3xl font-bold">Track your order</h1>
      <form method="get" className="mt-6 flex gap-2">
        <label htmlFor="order-id" className="sr-only">Order number</label>
        <input
          id="order-id"
          name="id"
          defaultValue={id}
          placeholder="Order number (e.g. SS-104233)"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600 dark:placeholder:text-zinc-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/30 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="submit"
          className="rounded-full bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700"
        >
          Track
        </button>
      </form>

      {id && !order && (
        <p role="alert" className="mt-6 text-sm text-red-700 dark:text-red-400">
          No order {id} on your account.
        </p>
      )}

      {order && (
        <ol className="mt-8 space-y-4" aria-label={`Status of order ${order.id}`}>
          {steps.map((step, i) => {
            const done = i <= current;
            return (
              <li key={step} className="flex items-center gap-3" aria-current={i === current ? "step" : undefined}>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? "bg-red-600 text-white"
                      : "bg-zinc-200 text-zinc-600 dark:text-zinc-400 dark:bg-zinc-800"
                  }`}
                >
                  {i + 1}
                </span>
                <span className={done ? "font-medium" : "text-zinc-600 dark:text-zinc-400"}>
                  {LABELS[step]}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

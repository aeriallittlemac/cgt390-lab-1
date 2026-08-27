"use client";

import { useState } from "react";
import type { OrderStatus } from "@/lib/types";

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: "received", label: "Order received" },
  { key: "making", label: "Making your pizza" },
  { key: "baking", label: "In the oven" },
  { key: "ready", label: "Ready" },
  { key: "out", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];

export default function TrackerPage() {
  const [orderId, setOrderId] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  // Mock: derive a deterministic "current step" from the order id length.
  const currentStep = submitted
    ? Math.min(STEPS.length - 1, (submitted.length % STEPS.length) || 1)
    : -1;

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-3xl font-bold">Track your order</h1>
      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(orderId.trim() || null);
        }}
      >
        <input
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="Order number (e.g. SS-1042)"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/30 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="submit"
          className="rounded-full bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700"
        >
          Track
        </button>
      </form>

      {submitted && (
        <ol className="mt-8 space-y-4">
          {STEPS.map((step, i) => {
            const done = i <= currentStep;
            return (
              <li key={step.key} className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? "bg-red-600 text-white"
                      : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800"
                  }`}
                >
                  {i + 1}
                </span>
                <span className={done ? "font-medium" : "text-zinc-500"}>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-8 text-xs text-zinc-400">
        Tracking is mocked in this build — any order number shows a sample status.
      </p>
    </div>
  );
}

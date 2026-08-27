import Link from "next/link";
import dealsData from "@/data/deals.json";
import type { Deal } from "@/lib/types";
import { OrderNowButton } from "@/components/header/OrderNowButton";

const deals = dealsData as Deal[];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="grid items-center gap-8 py-16 sm:grid-cols-2">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Hot pizza, your way.
          </h1>
          <p className="mt-4 max-w-md text-lg text-zinc-600 dark:text-zinc-300">
            Set your address, build your pie, and choose delivery or pickup.
            We&apos;ll take it from there.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <OrderNowButton />
            <Link
              href="/menu"
              className="inline-flex h-11 items-center rounded-full border border-zinc-300 px-5 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Browse the menu
            </Link>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <div className="flex h-64 w-64 items-center justify-center rounded-full bg-red-50 text-8xl dark:bg-red-950/30">
            🍕
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-2xl font-bold">Today&apos;s deals</h2>
          <Link href="/deals" className="text-sm font-medium text-red-600 hover:underline">
            See all
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {deals.map((deal) => (
            <li
              key={deal.id}
              className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <p className="font-semibold">{deal.title}</p>
              <p className="mt-1 text-sm text-zinc-500">{deal.description}</p>
              <p className="mt-3 inline-block rounded bg-zinc-100 px-2 py-1 font-mono text-xs dark:bg-zinc-800">
                {deal.code}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import dealsData from "@/data/deals.json";
import type { Deal } from "@/lib/types";

export const metadata: Metadata = { title: "Deals — Slice Society" };

const deals = dealsData as Deal[];

export default function DealsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Deals</h1>
      <ul className="grid gap-4 sm:grid-cols-2">
        {deals.map((deal) => (
          <li
            key={deal.id}
            className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
          >
            {/* Sizes mirror the grid: 1 col, 2 at sm in a max-w-4xl container. */}
            <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <Image
                src={deal.image}
                alt=""
                fill
                sizes="(min-width: 896px) 430px, (min-width: 640px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <h2 className="text-lg font-semibold">{deal.title}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{deal.description}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs dark:bg-zinc-800">
                {deal.code}
              </span>
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                Ends {new Date(deal.expiresAt).toLocaleDateString()}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

import type { Deal } from "@/lib/types";

export function DealPopover({ deals }: { deals: Deal[] }) {
  return (
    <div className="w-72 rounded-lg border border-red-200 bg-white p-3 shadow-lg dark:border-red-900 dark:bg-zinc-900">
      <ul className="space-y-3">
        {deals.map((deal) => (
          <li key={deal.id}>
            <p className="text-sm font-semibold text-red-600">{deal.title}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{deal.description}</p>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-zinc-800">
                {deal.code}
              </span>
              <span className="text-[11px] text-zinc-400">
                Ends {new Date(deal.expiresAt).toLocaleDateString()}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

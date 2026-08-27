"use client";

import { useMemo, useState } from "react";
import menuData from "@/data/menu.json";
import type { MenuItem } from "@/lib/types";
import { formatPrice } from "@/components/common/Price";
import { ItemCustomizer } from "./ItemCustomizer";

const menu = menuData as MenuItem[];

export function MenuBrowser() {
  const categories = useMemo(
    () => [...new Set(menu.map((m) => m.category))],
    [],
  );
  const [active, setActive] = useState(categories[0]);
  const [editing, setEditing] = useState<MenuItem | null>(null);

  const visible = menu.filter((m) => m.category === active);

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActive(c)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              c === active
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => (
          <li
            key={item.id}
            className="flex flex-col rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="mb-3 flex h-32 items-center justify-center rounded-lg bg-zinc-100 text-4xl dark:bg-zinc-800">
              🍕
            </div>
            <h3 className="font-semibold">{item.name}</h3>
            <p className="mt-1 flex-1 text-sm text-zinc-500">{item.description}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-semibold">
                {formatPrice(item.basePrice)}
              </span>
              <button
                type="button"
                onClick={() => setEditing(item)}
                className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                Customize
              </button>
            </div>
          </li>
        ))}
      </ul>

      <ItemCustomizer item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

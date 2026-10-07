"use client";

import { useMemo, useState } from "react";
import { sendGAEvent } from "@next/third-parties/google";
import menuData from "@/data/menu.json";
import dealsData from "@/data/deals.json";
import type { Deal, MenuItem } from "@/lib/types";
import { ItemCustomizer } from "./ItemCustomizer";
import { MenuItemCard } from "./MenuItemCard";

const menu = menuData as MenuItem[];
const deals = dealsData as Deal[];

export function MenuBrowser() {
  const categories = useMemo(
    () => [...new Set(menu.map((m) => m.category))],
    [],
  );
  const [active, setActive] = useState(categories[0]);
  const [editing, setEditing] = useState<MenuItem | null>(null);

  const dealsByItemId = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const deal of deals) {
      for (const itemId of deal.appliesTo) {
        map.set(itemId, [...(map.get(itemId) ?? []), deal]);
      }
    }
    return map;
  }, []);

  const visible = menu.filter((m) => m.category === active);

  function handleCustomizeClick(item: MenuItem) {
    // Diagnostic event: fires when a shopper opens the customizer, whether or not they finish.
    sendGAEvent("event", "select_item", {
      item_id: item.id,
      item_name: item.name,
      item_category: item.category,
    });
    setEditing(item);
  }

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
          <MenuItemCard
            key={item.id}
            item={item}
            deals={dealsByItemId.get(item.id) ?? []}
            onCustomize={handleCustomizeClick}
          />
        ))}
      </ul>

      <ItemCustomizer item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

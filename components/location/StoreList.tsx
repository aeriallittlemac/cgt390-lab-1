"use client";

import { useMemo } from "react";
import storesData from "@/data/stores.json";
import type { Store, ServiceMode } from "@/lib/types";
import { haversineKm, formatDistance } from "@/lib/distance";

const stores = storesData as Store[];

interface Props {
  origin: { lat: number; lng: number } | null;
  mode: ServiceMode;
  selectedStoreId: string | null;
  onSelect: (store: Store) => void;
}

export function StoreList({ origin, mode, selectedStoreId, onSelect }: Props) {
  const ranked = useMemo(() => {
    return stores
      .filter((s) => s.services.includes(mode))
      .map((s) => ({
        store: s,
        distanceKm: origin ? haversineKm(origin, s) : null,
      }))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }, [origin, mode]);

  if (ranked.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No stores offer {mode} for this area yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {ranked.map(({ store, distanceKm }) => {
        const active = store.id === selectedStoreId;
        const outOfRange =
          mode === "delivery" &&
          distanceKm != null &&
          distanceKm > store.deliveryRadiusKm;
        return (
          <li key={store.id}>
            <button
              type="button"
              disabled={outOfRange}
              onClick={() => onSelect(store)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                active
                  ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              } ${outOfRange ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{store.name}</span>
                {distanceKm != null && (
                  <span className="shrink-0 text-xs text-zinc-500">
                    {formatDistance(distanceKm)}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-zinc-500">{store.address}</p>
              <p className="mt-1 text-xs text-zinc-500">
                Open {store.hours} · {store.services.join(" & ")}
                {outOfRange ? " · outside delivery range" : ""}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

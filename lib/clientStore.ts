"use client";

import { useSyncExternalStore } from "react";
import { readJSON, writeJSON } from "./storage";

/**
 * A tiny localStorage-backed external store, read through `useSyncExternalStore`.
 * This is the React-idiomatic way to surface browser-only persisted state
 * without calling `setState` inside an effect: the server snapshot is always the
 * fallback, and React swaps in the real client value after hydration.
 */
export interface ClientStore<T> {
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  set: (next: T) => void;
  subscribe: (cb: () => void) => () => void;
}

export function createLocalStore<T>(key: string, fallback: T): ClientStore<T> {
  let cached: T = fallback;
  let loaded = false;
  const listeners = new Set<() => void>();

  return {
    getSnapshot() {
      if (typeof window === "undefined") return fallback;
      if (!loaded) {
        cached = readJSON<T>(key, fallback);
        loaded = true;
      }
      return cached;
    },
    getServerSnapshot() {
      return fallback;
    },
    set(next: T) {
      cached = next;
      loaded = true;
      writeJSON(key, next);
      listeners.forEach((l) => l());
    },
    subscribe(cb: () => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

export function useStore<T>(store: ClientStore<T>): T {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}

/** True only after the first client render — use to defer hydration-sensitive UI. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

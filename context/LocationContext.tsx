"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ServiceMode, SelectedLocation } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/storage";
import { createLocalStore, useStore } from "@/lib/clientStore";

interface LocationContextValue {
  /** Whether the left-side location drawer is open. */
  isDrawerOpen: boolean;
  /** When true, confirming a location should send the user to /order. */
  pendingOrderIntent: boolean;
  open: (opts?: { orderIntent?: boolean }) => void;
  close: () => void;
  selectedLocation: SelectedLocation | null;
  setLocation: (location: SelectedLocation) => void;
  clearLocation: () => void;
  /** Delivery/pickup choice — a pending toggle before confirm, else the saved mode. */
  mode: ServiceMode;
  setMode: (mode: ServiceMode) => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

const locationStore = createLocalStore<SelectedLocation | null>(
  STORAGE_KEYS.location,
  null,
);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const selectedLocation = useStore(locationStore);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [pendingOrderIntent, setPendingOrderIntent] = useState(false);
  const [modeOverride, setModeOverride] = useState<ServiceMode | null>(null);

  const mode = modeOverride ?? selectedLocation?.mode ?? "delivery";

  const open = useCallback((opts?: { orderIntent?: boolean }) => {
    setPendingOrderIntent(Boolean(opts?.orderIntent));
    setIsDrawerOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsDrawerOpen(false);
    setPendingOrderIntent(false);
  }, []);

  const setLocation = useCallback((location: SelectedLocation) => {
    locationStore.set(location);
    setModeOverride(null);
  }, []);

  const clearLocation = useCallback(() => {
    locationStore.set(null);
    setModeOverride(null);
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({
      isDrawerOpen,
      pendingOrderIntent,
      open,
      close,
      selectedLocation,
      setLocation,
      clearLocation,
      mode,
      setMode: setModeOverride,
    }),
    [
      isDrawerOpen,
      pendingOrderIntent,
      open,
      close,
      selectedLocation,
      setLocation,
      clearLocation,
      mode,
    ],
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useLocation must be used within a <LocationProvider>");
  }
  return ctx;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/common/Drawer";
import { useLocation } from "@/context/LocationContext";
import type { Store, ServiceMode, SelectedLocation } from "@/lib/types";
import type { GeocodeResult } from "@/lib/geocode";
import { DeliveryPickupToggle } from "./DeliveryPickupToggle";
import { LocationSearchBox } from "./LocationSearchBox";
import { LocationMap } from "./LocationMap";
import { StoreList } from "./StoreList";
import { LocationConfirmBar } from "./LocationConfirmBar";

export function LocationDrawer() {
  const { isDrawerOpen, close } = useLocation();

  return (
    <Drawer
      open={isDrawerOpen}
      onClose={close}
      side="left"
      title="Choose your location"
    >
      {/* Remount the form each time the drawer opens so it re-seeds from the
          currently confirmed location without a setState-in-effect. */}
      <LocationDrawerBody key={isDrawerOpen ? "open" : "closed"} />
    </Drawer>
  );
}

function LocationDrawerBody() {
  const router = useRouter();
  const { close, mode, setMode, selectedLocation, setLocation, pendingOrderIntent } =
    useLocation();

  const [address, setAddress] = useState<GeocodeResult | null>(
    selectedLocation
      ? {
          label: selectedLocation.label,
          lat: selectedLocation.lat,
          lng: selectedLocation.lng,
        }
      : null,
  );
  const [store, setStore] = useState<Store | null>(null);

  function handleConfirm() {
    if (!address || !store) return;
    const next: SelectedLocation = {
      label: address.label,
      lat: address.lat,
      lng: address.lng,
      mode: mode as ServiceMode,
      storeId: store.id,
    };
    setLocation(next);
    close();
    if (pendingOrderIntent) router.push("/order");
  }

  return (
    <>
      <div className="space-y-5 p-4">
        <DeliveryPickupToggle value={mode} onChange={setMode} />
        <LocationSearchBox
          onPick={(r) => {
            setAddress(r);
            setStore(null);
          }}
        />
        <LocationMap
          center={address ? { lat: address.lat, lng: address.lng } : null}
        />

        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-500">
            {mode === "delivery" ? "Delivering from" : "Pickup stores"}
          </h3>
          <StoreList
            origin={address ? { lat: address.lat, lng: address.lng } : null}
            mode={mode}
            selectedStoreId={store?.id ?? null}
            onSelect={setStore}
          />
        </div>
      </div>

      <LocationConfirmBar
        mode={mode}
        disabled={!address || !store}
        onConfirm={handleConfirm}
      />
    </>
  );
}

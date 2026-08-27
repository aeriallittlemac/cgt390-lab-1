"use client";

import { LocationProvider } from "./LocationContext";
import { CartProvider } from "./CartContext";

/**
 * Single client boundary that mounts every global provider. Rendered once in the
 * root layout so the rest of the tree stays server components where possible.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LocationProvider>
      <CartProvider>{children}</CartProvider>
    </LocationProvider>
  );
}

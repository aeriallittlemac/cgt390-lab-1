import type { MenuItem } from "./types";

export const ADD_ON_PRICE = 1.5;

/** Unit price in dollars, rounded to cents. Shared by the customizer and the order API. */
export function unitPriceFor(item: MenuItem, sizeLabel: string, addOnCount: number): number {
  const sizeDelta = item.sizes.find((s) => s.label === sizeLabel)?.priceDelta ?? 0;
  return Math.round((item.basePrice + sizeDelta + addOnCount * ADD_ON_PRICE) * 100) / 100;
}

// Shared data model shapes. See PLAN.md section 9.

export type ServiceMode = "delivery" | "pickup";

export interface Store {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  hours: string;
  services: ServiceMode[];
  deliveryRadiusKm: number;
}

export interface MenuItemSize {
  label: string;
  priceDelta: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  image: string;
  basePrice: number;
  sizes: MenuItemSize[];
  crusts: string[];
  toppings: string[];
}

export interface Deal {
  id: string;
  title: string;
  description: string;
  code: string;
  image: string;
  expiresAt: string;
  /** Menu item ids this deal applies to. Empty for storewide deals not tied to a specific item. */
  appliesTo: string[];
}

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  size: string;
  crust: string;
  toppings: string[];
  qty: number;
  unitPrice: number;
}

export type OrderStatus =
  | "received"
  | "making"
  | "baking"
  | "ready"
  | "out"
  | "delivered";

export interface Order {
  id: string;
  storeId: string;
  mode: ServiceMode;
  items: CartItem[];
  status: OrderStatus;
  placedAt: string;
}

export interface RewardHistoryEntry {
  date: string;
  label: string;
  points: number;
}

export interface Reward {
  points: number;
  tier: string;
  history: RewardHistoryEntry[];
}

/** A confirmed delivery/pickup location chosen in the location drawer. */
export interface SelectedLocation {
  label: string;
  lat: number;
  lng: number;
  mode: ServiceMode;
  storeId: string | null;
}

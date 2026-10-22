import menuData from "@/data/menu.json";
import storesData from "@/data/stores.json";
import type { MenuItem, ServiceMode, Store } from "./types";
import { unitPriceFor } from "./pricing";

// Server-side contract for POST /api/orders. The client says *what* it wants
// (item ids and options); the server owns everything else: prices, totals,
// order id, status and timestamp.

const menu = menuData as MenuItem[];
const stores = storesData as Store[];

export const MAX_QTY = 20;

const ORDER_FIELDS = ["mode", "storeId", "items"];
const LINE_FIELDS = ["menuItemId", "size", "crust", "toppings", "qty"];

export interface OrderLine {
  menuItemId: string;
  name: string;
  size: string;
  crust: string;
  toppings: string[];
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ValidOrder {
  mode: ServiceMode;
  storeId: string;
  items: OrderLine[];
  subtotal: number;
}

/** 400 = the request is malformed; 422 = well formed but breaks a business rule. */
export type OrderResult =
  | { ok: true; order: ValidOrder }
  | { ok: false; status: 400 | 422; error: string };

const bad = (error: string): OrderResult => ({ ok: false, status: 400, error });
const rule = (error: string): OrderResult => ({ ok: false, status: 422, error });

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function unexpectedFields(obj: Record<string, unknown>, allowed: string[]): string[] {
  return Object.keys(obj).filter((k) => !allowed.includes(k));
}

export function validateOrder(body: unknown): OrderResult {
  if (!isPlainObject(body)) return bad("Body must be a JSON object");

  const extra = unexpectedFields(body, ORDER_FIELDS);
  if (extra.length) return bad(`Unexpected field(s): ${extra.join(", ")}`);

  const { mode, storeId, items } = body;
  if (mode !== "delivery" && mode !== "pickup") {
    return bad('mode must be "delivery" or "pickup"');
  }
  if (typeof storeId !== "string" || !storeId) return bad("storeId is required");
  if (!Array.isArray(items)) return bad("items must be an array");

  const store = stores.find((s) => s.id === storeId);
  if (!store) return rule(`Unknown store: ${storeId}`);
  if (!store.services.includes(mode)) {
    return rule(`${store.name} does not offer ${mode === "delivery" ? "delivery" : "pickup"}`);
  }
  if (items.length === 0) return rule("Order must contain at least one item");

  const lines: OrderLine[] = [];
  for (const [i, raw] of items.entries()) {
    const at = `items[${i}]`;
    if (!isPlainObject(raw)) return bad(`${at} must be an object`);

    const extraLine = unexpectedFields(raw, LINE_FIELDS);
    if (extraLine.length) return bad(`${at}: unexpected field(s): ${extraLine.join(", ")}`);

    const { menuItemId, size, crust = "", toppings = [], qty } = raw;
    if (typeof menuItemId !== "string") return bad(`${at}.menuItemId is required`);
    if (typeof size !== "string") return bad(`${at}.size is required`);
    if (typeof crust !== "string") return bad(`${at}.crust must be a string`);
    if (!Array.isArray(toppings) || !toppings.every((t) => typeof t === "string")) {
      return bad(`${at}.toppings must be an array of strings`);
    }
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      return bad(`${at}.qty must be a whole number from 1 to ${MAX_QTY}`);
    }

    const item = menu.find((m) => m.id === menuItemId);
    if (!item) return bad(`${at}.menuItemId is not on the menu: ${menuItemId}`);
    if (!item.sizes.some((s) => s.label === size)) {
      return bad(`${at}.size "${size}" is not offered for ${item.name}`);
    }
    if (item.crusts.length ? !item.crusts.includes(crust) : crust !== "") {
      return bad(`${at}.crust "${crust}" is not offered for ${item.name}`);
    }
    const badTopping = toppings.find((t) => !item.toppings.includes(t));
    if (badTopping !== undefined) {
      return bad(`${at}.toppings: "${badTopping}" is not offered for ${item.name}`);
    }
    if (new Set(toppings).size !== toppings.length) {
      return bad(`${at}.toppings contains duplicates`);
    }

    const unitPrice = unitPriceFor(item, size, toppings.length);
    lines.push({
      menuItemId,
      name: item.name,
      size,
      crust,
      toppings,
      qty,
      unitPrice,
      lineTotal: Math.round(unitPrice * qty * 100) / 100,
    });
  }

  const subtotal = Math.round(lines.reduce((sum, l) => sum + l.lineTotal, 0) * 100) / 100;
  return { ok: true, order: { mode, storeId, items: lines, subtotal } };
}

import "server-only";
import { createHash, randomInt } from "node:crypto";
import { all, batch, get, run } from "./db";
import type { OrderLine, ValidOrder } from "./orders";
import type { OrderStatus, PublicUser, ServiceMode } from "./types";

export interface PlacedOrder extends ValidOrder {
  id: string;
  status: OrderStatus;
  placedAt: string;
}

// Status moves forward one step at a time. Pickup orders end at "ready".
const FLOW: Record<ServiceMode, OrderStatus[]> = {
  pickup: ["received", "making", "baking", "ready"],
  delivery: ["received", "making", "baking", "ready", "out", "delivered"],
};

export const ORDER_STATUSES: OrderStatus[] = FLOW.delivery;

export const statusSteps = (mode: ServiceMode): OrderStatus[] => FLOW[mode];

export function nextStatus(mode: ServiceMode, current: OrderStatus): OrderStatus | null {
  const steps = FLOW[mode];
  return steps[steps.indexOf(current) + 1] ?? null;
}

const toCents = (dollars: number) => Math.round(dollars * 100);
const toDollars = (cents: number) => cents / 100;

interface OrderRow {
  id: string;
  user_id: string;
  store_id: string;
  mode: ServiceMode;
  status: OrderStatus;
  subtotal_cents: number;
  placed_at: string;
}

interface ItemRow {
  menu_item_id: string;
  name: string;
  size: string;
  crust: string;
  toppings: string;
  qty: number;
  unit_price_cents: number;
}

async function hydrate(row: OrderRow): Promise<PlacedOrder> {
  const items = (
    await all<ItemRow>(
      `SELECT menu_item_id, name, size, crust, toppings, qty, unit_price_cents
       FROM order_items WHERE order_id = ? ORDER BY line_no`,
      [row.id],
    )
  ).map(
    (it): OrderLine => ({
      menuItemId: it.menu_item_id,
      name: it.name,
      size: it.size,
      crust: it.crust,
      toppings: JSON.parse(it.toppings) as string[],
      qty: it.qty,
      unitPrice: toDollars(it.unit_price_cents),
      lineTotal: toDollars(it.unit_price_cents * it.qty),
    }),
  );
  return {
    id: row.id,
    status: row.status,
    placedAt: row.placed_at,
    mode: row.mode,
    storeId: row.store_id,
    items,
    subtotal: toDollars(row.subtotal_cents),
  };
}

export type SaveResult =
  | { ok: true; order: PlacedOrder; replayed: boolean }
  | { ok: false; status: 422; error: string };

/** Fingerprint of what the customer chose (not prices), to compare repeats of one checkout. */
function requestHash(order: ValidOrder): string {
  const choices = {
    mode: order.mode,
    storeId: order.storeId,
    items: order.items.map(({ menuItemId, size, crust, toppings, qty }) => ({ menuItemId, size, crust, toppings, qty })),
  };
  return createHash("sha256").update(JSON.stringify(choices)).digest("hex");
}

/** The order an earlier request with this key created for this user, if any. */
async function findByKey(userId: string, key: string, hash: string): Promise<SaveResult | null> {
  const row = await get<OrderRow & { request_hash: string | null }>(
    "SELECT * FROM orders WHERE user_id = ? AND idempotency_key = ?",
    [userId, key],
  );
  if (!row) return null;
  if (row.request_hash !== hash) {
    return {
      ok: false,
      status: 422,
      error: `This checkout was already placed as order ${row.id} with different items. Reload the page to start a new order.`,
    };
  }
  return { ok: true, order: await hydrate(row), replayed: true };
}

/**
 * Saves a validated order for its owner and returns it as stored.
 * With an idempotency key (one per checkout attempt), a repeat of the same
 * request returns the order it already created instead of saving another.
 * Keys are per user, so one customer's key never finds another's order.
 */
export async function saveOrder(userId: string, order: ValidOrder, idempotencyKey?: string): Promise<SaveResult> {
  const hash = idempotencyKey ? requestHash(order) : null;
  if (idempotencyKey && hash) {
    const earlier = await findByKey(userId, idempotencyKey, hash);
    if (earlier) return earlier;
  }

  const placedAt = new Date().toISOString();
  // Six random digits; retry on the rare collision with an existing id.
  // (The primary key still rejects a duplicate that slips in between.)
  let id: string;
  do {
    id = `SS-${randomInt(100000, 1000000)}`;
  } while (await get("SELECT 1 FROM orders WHERE id = ?", [id]));

  // The order and its items are written together or not at all.
  try {
    await batch([
      {
        sql: `INSERT INTO orders
                (id, user_id, store_id, mode, status, subtotal_cents, placed_at, idempotency_key, request_hash)
              VALUES (?, ?, ?, ?, 'received', ?, ?, ?, ?)`,
        args: [id, userId, order.storeId, order.mode, toCents(order.subtotal), placedAt, idempotencyKey ?? null, hash],
      },
      ...order.items.map((it, i) => ({
        sql: `INSERT INTO order_items
                (order_id, line_no, menu_item_id, name, size, crust, toppings, qty, unit_price_cents)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          i,
          it.menuItemId,
          it.name,
          it.size,
          it.crust,
          JSON.stringify(it.toppings),
          it.qty,
          toCents(it.unitPrice),
        ],
      })),
    ]);
  } catch (err) {
    // Two copies of one checkout raced past the check above (e.g. a double-click);
    // the unique index let only one in, so answer this one with that order.
    if (idempotencyKey && hash && /UNIQUE constraint failed: orders\.user_id, orders\.idempotency_key/.test(String(err))) {
      const earlier = await findByKey(userId, idempotencyKey, hash);
      if (earlier) return earlier;
    }
    throw err;
  }

  return { ok: true, order: { id, status: "received", placedAt, ...order }, replayed: false };
}

/**
 * Authorization lives here, next to the data: customers see only their own
 * orders, staff see all. A customer asking for someone else's order gets the
 * same null as for a missing one, so order ids can't be probed.
 */
export async function getOrderFor(viewer: PublicUser, id: string): Promise<PlacedOrder | null> {
  const row = await get<OrderRow>("SELECT * FROM orders WHERE id = ?", [id]);
  if (!row) return null;
  if (viewer.role !== "staff" && row.user_id !== viewer.id) return null;
  return hydrate(row);
}

export async function listOrdersFor(viewer: PublicUser): Promise<PlacedOrder[]> {
  const rows =
    viewer.role === "staff"
      ? await all<OrderRow>("SELECT * FROM orders ORDER BY placed_at DESC")
      : await all<OrderRow>("SELECT * FROM orders WHERE user_id = ? ORDER BY placed_at DESC", [viewer.id]);
  return Promise.all(rows.map(hydrate));
}

export type StatusUpdate =
  | { ok: true; order: PlacedOrder }
  | { ok: false; status: 404 | 409; error: string };

/** Moves an order to its next status. Callers must already have checked the staff role. */
export async function advanceStatus(id: string, to: OrderStatus): Promise<StatusUpdate> {
  const row = await get<OrderRow>("SELECT * FROM orders WHERE id = ?", [id]);
  if (!row) return { ok: false, status: 404, error: "Order not found" };

  const allowed = nextStatus(row.mode, row.status);
  if (to !== allowed) {
    return {
      ok: false,
      status: 409,
      error: allowed
        ? `A ${row.mode} order that is "${row.status}" can only move to "${allowed}"`
        : `Order is already "${row.status}", its final status`,
    };
  }
  // Only apply if the status is still what we checked, so two staff clicking at once can't skip a step.
  const changed = await run("UPDATE orders SET status = ? WHERE id = ? AND status = ?", [to, id, row.status]);
  if (!changed) return { ok: false, status: 409, error: "Order status changed; reload and try again" };
  return { ok: true, order: await hydrate({ ...row, status: to }) };
}

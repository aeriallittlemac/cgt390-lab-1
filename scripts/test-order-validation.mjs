// Form-handling tests for POST /api/orders: does the server reject invalid
// checkout payloads before anything is written to the database?
//
// Usage (local or isolated builds only; it creates a fictional account and orders):
//   DATABASE_PATH=/path/to/test.db  (same file the server under test uses)
//   node scripts/test-order-validation.mjs http://localhost:3100
//
// Sends each payload straight to the API, bypassing the UI, and reads the
// orders and order_items tables (read-only) before and after every request,
// so "nothing was saved" is checked in the database, not taken from the response.
// Exit code is 1 if any case fails.

import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createClient, createReporter, uniqueEmail } from "./lib/client.mjs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const dbPath = process.env.DATABASE_PATH ?? join(process.cwd(), ".data", "slice-society.db");
const menu = JSON.parse(readFileSync(join(process.cwd(), "data", "menu.json"), "utf8"));

const customer = createClient(BASE);
const r = createReporter();

// ---------- Setup (signing up also makes the server create its database) ----------

const signup = await customer.request("POST", "/api/auth/signup", {
  body: { name: "Validation Tester", email: uniqueEmail("validation"), password: "test-pass-123" },
});
if (signup.status !== 201) {
  console.error(`Setup failed: could not create a test account (${signup.status} ${signup.text})`);
  process.exit(2);
}
const user = signup.json.user;
if (!existsSync(dbPath)) {
  console.error(`No database at ${dbPath}. Set DATABASE_PATH to the file the server under test uses.`);
  process.exit(2);
}
console.log(`Setup: signed up fictional customer ${user.email}. Database: ${dbPath}`);

// ---------- Database snapshots (read-only) ----------

const db = new DatabaseSync(dbPath, { readOnly: true });
if (!db.prepare("SELECT 1 FROM users WHERE id = ?").get(user.id)) {
  console.error(`${dbPath} isn't the server's database: the new account isn't in it.`);
  process.exit(2);
}
const counts = () => db.prepare(
  "SELECT (SELECT COUNT(*) FROM orders) AS orders, (SELECT COUNT(*) FROM order_items) AS order_items",
).get();
const ordersFor = (userId) => db.prepare(
  `SELECT o.id, o.mode, o.store_id, o.status, o.subtotal_cents,
          COUNT(i.line_no) AS lines, COALESCE(SUM(i.qty * i.unit_price_cents), 0) AS items_total_cents
   FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
   WHERE o.user_id = ? GROUP BY o.id ORDER BY o.placed_at`,
).all(userId);
const itemsFor = (userId) => db.prepare(
  `SELECT i.* FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.user_id = ?`,
).all(userId);

/** Every stored line for this user that breaks a menu or quantity rule. */
function invalidRows(userId) {
  const problems = [];
  for (const row of itemsFor(userId)) {
    const item = menu.find((m) => m.id === row.menu_item_id);
    const toppings = JSON.parse(row.toppings);
    const at = `${row.order_id} line ${row.line_no}`;
    if (!item) problems.push(`${at}: unknown menu item ${row.menu_item_id}`);
    else {
      if (!item.sizes.some((s) => s.label === row.size)) problems.push(`${at}: size ${row.size} not offered`);
      const bad = toppings.filter((t) => !item.toppings.includes(t));
      if (bad.length) problems.push(`${at}: toppings not offered: ${bad.join(", ")}`);
    }
    if (!Number.isInteger(row.qty) || row.qty < 1 || row.qty > 20) problems.push(`${at}: qty ${row.qty}`);
  }
  for (const o of ordersFor(userId)) {
    if (o.lines === 0) problems.push(`${o.id}: order with no items`);
    if (o.subtotal_cents !== o.items_total_cents) problems.push(`${o.id}: subtotal ${o.subtotal_cents} != items ${o.items_total_cents}`);
  }
  return problems;
}

const fmt = (c) => `orders ${c.orders}, order_items ${c.order_items}`;

const BEFORE = counts();
console.log(`\nBEFORE (whole database): ${fmt(BEFORE)}`);
console.log(`BEFORE (this customer):  ${JSON.stringify(ordersFor(user.id))}`);

// A valid line: Pepperoni 18" ($15 + $8) + 1 topping ($1.50) = $24.50.
const line = { menuItemId: "pizza-pepperoni", size: '18"', crust: "Classic", toppings: ["Jalapeno"], qty: 1 };
const order = (lineOverrides = {}, orderOverrides = {}) => ({
  mode: "delivery",
  storeId: "store-downtown",
  items: [{ ...line, ...lineOverrides }],
  ...orderOverrides,
});
const without = (obj, key) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));

/** Sends one payload, compares status and error, and checks the tables didn't change. */
async function rejectCase(group, name, payload, { status, mentions, raw }) {
  const before = counts();
  const res = await customer.request("POST", "/api/orders", raw ? { raw: payload } : { body: payload });
  const after = counts();
  const unchanged = after.orders === before.orders && after.order_items === before.order_items;
  const errorOk = mentions ? mentions.test(res.json?.error ?? "") : true;
  r.check(group, name, `${status}${mentions ? ` naming ${mentions.source}` : ""}; no rows written`, res,
    res.status === status && errorOk && unchanged,
    `DB before → after: ${fmt(before)} → ${fmt(after)}${unchanged ? " (unchanged)" : " (ROWS WRITTEN)"}`);
}

// ---------- 0 Control: a valid order IS written, at the server's price ----------

{
  const before = counts();
  const res = await customer.request("POST", "/api/orders", { body: order() });
  const after = counts();
  const stored = res.json?.id ? ordersFor(user.id).find((o) => o.id === res.json.id) : null;
  r.check("0 Control", "Valid order (proves the database does record good orders)",
    "201; 1 order + 1 item written, subtotal 2450 cents", res,
    res.status === 201 && after.orders === before.orders + 1 && after.order_items === before.order_items + 1 && stored?.subtotal_cents === 2450,
    `DB before → after: ${fmt(before)} → ${fmt(after)}; stored subtotal_cents=${stored?.subtotal_cents}`);
}

// ---------- 1 Missing required fields ----------

await rejectCase("1 Missing field", "Pizza with no size", order({ size: undefined }), { status: 400, mentions: /size/ });
await rejectCase("1 Missing field", "Line with no menuItemId", { ...order(), items: [without(line, "menuItemId")] }, { status: 400, mentions: /menuItemId/ });
await rejectCase("1 Missing field", "Line with no qty", { ...order(), items: [without(line, "qty")] }, { status: 400, mentions: /qty/ });
await rejectCase("1 Missing field", "Order with no storeId", without(order(), "storeId"), { status: 400, mentions: /storeId/ });
await rejectCase("1 Missing field", "Order with no items", without(order(), "items"), { status: 400, mentions: /items/ });
await rejectCase("1 Missing field", "Order with an empty items list", order({}, { items: [] }), { status: 422, mentions: /at least one item/ });

// ---------- 2 Bad quantities ----------

await rejectCase("2 Quantity", "Negative quantity (-2)", order({ qty: -2 }), { status: 400, mentions: /qty/ });
await rejectCase("2 Quantity", "Zero quantity", order({ qty: 0 }), { status: 400, mentions: /qty/ });
await rejectCase("2 Quantity", "Fractional quantity (1.5)", order({ qty: 1.5 }), { status: 400, mentions: /qty/ });
await rejectCase("2 Quantity", "Quantity as a string (\"2\")", order({ qty: "2" }), { status: 400, mentions: /qty/ });
await rejectCase("2 Quantity", "Quantity over the limit (21)", order({ qty: 21 }), { status: 400, mentions: /qty/ });

// ---------- 3 Unsupported options / category ----------

await rejectCase("3 Unsupported", "Topping not on the menu (Pineapple)", order({ toppings: ["Pineapple"] }), { status: 400, mentions: /Pineapple/ });
await rejectCase("3 Unsupported", "Topping from a different pizza (Garlic is Margherita-only)", order({ toppings: ["Garlic"] }), { status: 400, mentions: /Garlic/ });
await rejectCase("3 Unsupported", "Same topping twice", order({ toppings: ["Jalapeno", "Jalapeno"] }), { status: 400, mentions: /duplicates/ });
await rejectCase("3 Unsupported", "Size not offered (24\")", order({ size: '24"' }), { status: 400, mentions: /size/ });
await rejectCase("3 Unsupported", "Crust on a drink", { ...order(), items: [{ menuItemId: "drink-soda", size: "20 oz", crust: "Thin", toppings: [], qty: 1 }] }, { status: 400, mentions: /crust/ });
await rejectCase("3 Unsupported", "Item not on the menu (pizza-dessert)", order({ menuItemId: "pizza-dessert" }), { status: 400, mentions: /menuItemId/ });
await rejectCase("3 Unsupported", "Client-supplied category (\"Desserts\")", order({ category: "Desserts" }), { status: 400, mentions: /category/ });
await rejectCase("3 Unsupported", "Unknown store", order({}, { storeId: "store-nowhere" }), { status: 422, mentions: /Unknown store/ });
await rejectCase("3 Unsupported", "Delivery from a pickup-only store", order({}, { storeId: "store-wicker" }), { status: 422, mentions: /delivery/ });

// ---------- 4 Tampered prices and server-owned fields ----------

await rejectCase("4 Tampered", "Line unitPrice set to $0.01", order({ unitPrice: 0.01 }), { status: 400, mentions: /unitPrice/ });
await rejectCase("4 Tampered", "Line lineTotal set to $0", order({ lineTotal: 0 }), { status: 400, mentions: /lineTotal/ });
await rejectCase("4 Tampered", "Order subtotal set to $0.01", order({}, { subtotal: 0.01 }), { status: 400, mentions: /subtotal/ });
await rejectCase("4 Tampered", "Negative price (-24.50)", order({ unitPrice: -24.5 }), { status: 400, mentions: /unitPrice/ });
await rejectCase("4 Tampered", "Order status set to \"delivered\"", order({}, { status: "delivered" }), { status: 400, mentions: /status/ });
await rejectCase("4 Tampered", "Order id chosen by the client", order({}, { id: "SS-000001" }), { status: 400, mentions: /\bid\b/ });

// ---------- 5 Malformed bodies ----------

await rejectCase("5 Malformed", "Body isn't valid JSON", '{"mode":"delivery",', { status: 400, raw: true });
await rejectCase("5 Malformed", "Body is a JSON array", "[]", { status: 400, raw: true });
await rejectCase("5 Malformed", "items is a string", order({}, { items: "1 large pepperoni" }), { status: 400, mentions: /items/ });

// ---------- After ----------

const AFTER = counts();
const mine = ordersFor(user.id);
const problems = invalidRows(user.id);
console.log(`\nAFTER (whole database):  ${fmt(AFTER)}`);
console.log(`AFTER (this customer):   ${JSON.stringify(mine)}`);
console.log(`Net change: orders +${AFTER.orders - BEFORE.orders}, order_items +${AFTER.order_items - BEFORE.order_items} (expected +1/+1, the control order only)`);
console.log(`Invalid stored rows for this customer: ${problems.length ? problems.join("; ") : "none"}`);

r.check("6 Final state", "Only the valid control order was saved, and it breaks no rule",
  "net +1 order, +1 item, 0 invalid rows",
  { status: "DB", text: `orders +${AFTER.orders - BEFORE.orders}, order_items +${AFTER.order_items - BEFORE.order_items}, invalid rows: ${problems.length}`, sent: { method: "SELECT", path: "orders, order_items" } },
  AFTER.orders - BEFORE.orders === 1 && AFTER.order_items - BEFORE.order_items === 1 && problems.length === 0 && mine.length === 1);

r.finish(BASE);

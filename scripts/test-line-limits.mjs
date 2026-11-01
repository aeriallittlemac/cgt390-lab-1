// Measures how POST /api/orders behaves as the number of line items grows.
// Nothing here changes validation or the schema; it only records current behavior.
//
// Usage:
//   node scripts/test-line-limits.mjs                         # http://localhost:3000
//   node scripts/test-line-limits.mjs https://your-site.app   # any build that shares this DB file
//   node scripts/test-line-limits.mjs --cleanup               # delete the orders this script created
//
// Every order is placed by one fixed test account (EMAIL below), so cleanup can
// find them by owner. Stored row counts come straight from the SQLite file, not
// from the API, so they show what was actually saved.

import { join } from "node:path";
import { existsSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { createClient } from "./lib/client.mjs";

const EMAIL = "line-limit-test@example.test";
const PASSWORD = "line-limit-pass-123";
const SIZES = [1, 10, 50, 200, 1000];
const TRIALS = 3;

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3000").replace(/\/$/, "");
const dbPath = process.env.DATABASE_PATH ?? join(process.cwd(), ".data", "slice-society.db");
if (!existsSync(dbPath)) {
  console.error(`No database at ${dbPath}. Start the app once so it creates the file.`);
  process.exit(1);
}

if (args.includes("--cleanup")) {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA busy_timeout = 5000;");
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(EMAIL);
  if (!user) {
    console.log(`No account ${EMAIL}; nothing to clean up.`);
    process.exit(0);
  }
  db.exec("BEGIN");
  const items = db
    .prepare("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?)")
    .run(user.id).changes;
  const orders = db.prepare("DELETE FROM orders WHERE user_id = ?").run(user.id).changes;
  const sessions = db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id).changes;
  db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  db.exec("COMMIT");
  console.log(
    `Deleted ${orders} orders, ${items} order_items rows, ${sessions} sessions and the account ${EMAIL}.`,
  );
  process.exit(0);
}

// Read-only connection: this script never writes through it.
const db = new DatabaseSync(dbPath, { readOnly: true });
const countItems = db.prepare("SELECT COUNT(*) AS n FROM order_items WHERE order_id = ?");

// Same priced line as scripts/test-orders.mjs, with qty 1.
const line = { menuItemId: "pizza-margherita", size: '14"', crust: "Thin", toppings: ["Garlic"], qty: 1 };

// Log in as the fixed test user, creating the account the first time.
const client = createClient(BASE);
let auth = await client.request("POST", "/api/auth/login", { body: { email: EMAIL, password: PASSWORD } });
if (auth.status === 401) {
  auth = await client.request("POST", "/api/auth/signup", {
    body: { name: "Line Limit Tester", email: EMAIL, password: PASSWORD },
  });
}
if (auth.status !== 200 && auth.status !== 201) {
  console.error(`Setup failed: could not sign in as ${EMAIL} (${auth.status} ${auth.text})`);
  process.exit(2);
}
console.log(`Signed in as ${EMAIL} (${auth.status === 201 ? "new account" : "existing account"}).\n`);

const rows = [];
for (const size of SIZES) {
  const body = { mode: "pickup", storeId: "store-downtown", items: Array.from({ length: size }, () => line) };
  for (let trial = 1; trial <= TRIALS; trial++) {
    const start = performance.now();
    const res = await client.request("POST", "/api/orders", { body });
    const totalMs = performance.now() - start;

    const id = res.json?.id;
    const stored = typeof id === "string" ? countItems.get(id).n : null;
    rows.push({
      lines: size,
      trial,
      status: res.status,
      totalMs: totalMs.toFixed(1),
      respBytes: Buffer.byteLength(res.text),
      submitted: size,
      stored: stored ?? "n/a",
      note: res.status === 201 ? id : (res.json?.error ?? res.text.slice(0, 80)),
    });
  }
}

const headers = {
  lines: "Line count",
  trial: "Trial",
  status: "Status",
  totalMs: "Total request time (ms)",
  respBytes: "Response size (bytes)",
  submitted: "Submitted",
  stored: "Stored rows",
  note: "Order id / error",
};
const keys = Object.keys(headers);
const width = Object.fromEntries(
  keys.map((k) => [k, Math.max(headers[k].length, ...rows.map((r) => String(r[k]).length))]),
);
const fmt = (r) => keys.map((k) => String(r[k]).padEnd(width[k])).join(" | ");
console.log(fmt(headers));
console.log(keys.map((k) => "-".repeat(width[k])).join("-|-"));
rows.forEach((r) => console.log(fmt(r)));

const mismatches = rows.filter((r) => r.status === 201 && r.stored !== r.submitted);
console.log(
  `\nTotal request time is measured client-side (send to last response byte), not database time.` +
    `\nResponse size is the decoded body. ${mismatches.length} accepted orders stored a different row count than submitted.` +
    `\nRemove these test orders with: node scripts/test-line-limits.mjs --cleanup`,
);

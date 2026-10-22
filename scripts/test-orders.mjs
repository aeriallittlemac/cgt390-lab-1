// Contract tests for POST /api/orders (API and Data Design Workshop).
//
// Usage:
//   node scripts/test-orders.mjs                         # http://localhost:3000
//   node scripts/test-orders.mjs https://your-site.app   # any deployed build
//
// Each case sends a request with no cookies or auth headers (an anonymous
// client, like Postman), prints the request and response, and compares the
// response to the intended contract. Exit code is 1 if any case fails.

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const URL_ORDERS = `${BASE}/api/orders`;

// A correctly priced line: Margherita 14" (13.50 + 4.00) + 1 add-on (1.50) = 19.00.
const validLine = {
  menuItemId: "pizza-margherita",
  size: '14"',
  crust: "Thin",
  toppings: ["Garlic"],
  qty: 2,
};
const validOrder = { mode: "pickup", storeId: "store-downtown", items: [validLine] };

const isOrderId = (v) => typeof v === "string" && /^SS-\d{4,}$/.test(v);

const cases = [
  {
    group: "1 Successful action",
    name: "Valid pickup order from an anonymous guest",
    body: validOrder,
    expect: "201 with id, status received, server-computed prices, no echoed input",
    check: (s, b) =>
      s === 201 &&
      isOrderId(b?.id) &&
      b.status === "received" &&
      b.items?.[0]?.unitPrice === 19 &&
      b.subtotal === 38 &&
      !("echo" in b),
  },
  {
    group: "2 Invalid input",
    name: "Missing items",
    body: { mode: "pickup", storeId: "store-downtown" },
    expect: "400 naming the items field",
    check: (s, b) => s === 400 && /items/.test(b?.error ?? ""),
  },
  {
    group: "2 Invalid input",
    name: "Wrong type: qty is a string",
    body: { ...validOrder, items: [{ ...validLine, qty: "two" }] },
    expect: "400 naming qty",
    check: (s, b) => s === 400 && /qty/.test(b?.error ?? ""),
  },
  {
    group: "2 Invalid input",
    name: "Unacceptable value: size not offered for this item",
    body: { ...validOrder, items: [{ ...validLine, size: '99"' }] },
    expect: "400 naming size",
    check: (s, b) => s === 400 && /size/.test(b?.error ?? ""),
  },
  {
    group: "2 Invalid input",
    name: "Malformed JSON body",
    raw: "{ not json",
    expect: "400 invalid JSON",
    check: (s) => s === 400,
  },
  {
    group: "3 Access boundary",
    name: "Client tries to set server-owned fields (id, status)",
    body: { ...validOrder, id: "SS-0001", status: "delivered" },
    expect: "400 rejecting the unexpected fields; client cannot choose id or status",
    check: (s, b) => s === 400 && /id|status/.test(b?.error ?? ""),
  },
  {
    group: "3 Access boundary",
    name: "Anonymous GET tries to list all orders",
    method: "GET",
    expect: "405, there is no endpoint that lists other customers' orders",
    check: (s) => s === 405,
  },
  {
    group: "4 Edge case",
    name: "Tampered price: client sends unitPrice 0.01",
    body: { ...validOrder, items: [{ ...validLine, unitPrice: 0.01 }] },
    expect: "400; prices come from the menu, never from the client",
    check: (s, b) => s === 400 && /unitPrice/.test(b?.error ?? ""),
  },
  {
    group: "4 Edge case",
    name: "Nonexistent store",
    body: { ...validOrder, storeId: "store-atlantis" },
    expect: "422 unknown store",
    check: (s, b) => s === 422 && /store/i.test(b?.error ?? ""),
  },
  {
    group: "4 Edge case",
    name: "Delivery from a pickup-only store (store-wicker)",
    body: { ...validOrder, mode: "delivery", storeId: "store-wicker" },
    expect: "422 store does not offer delivery",
    check: (s, b) => s === 422 && /deliver/i.test(b?.error ?? ""),
  },
  {
    group: "4 Edge case",
    name: "Empty cart",
    body: { ...validOrder, items: [] },
    expect: "422 order must contain at least one item",
    check: (s, b) => s === 422 && /item/.test(b?.error ?? ""),
  },
];

let failed = 0;

for (const c of cases) {
  const method = c.method ?? "POST";
  const init = { method, headers: {} };
  if (method === "POST") {
    init.headers["Content-Type"] = "application/json";
    init.body = c.raw ?? JSON.stringify(c.body);
  }

  let status;
  let text;
  try {
    const res = await fetch(URL_ORDERS, init);
    status = res.status;
    text = await res.text();
  } catch (err) {
    console.error(`Could not reach ${URL_ORDERS}: ${err.message}`);
    console.error("Is the dev server running? Start it with: npm run dev");
    process.exit(2);
  }

  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON response (e.g. a 405 with an empty body)
  }

  const pass = c.check(status, json);
  if (!pass) failed++;

  console.log(`\n[${pass ? "PASS" : "FAIL"}] ${c.group} | ${c.name}`);
  console.log(`  Request:  ${method} /api/orders ${init.body ?? ""}`);
  console.log(`  Expected: ${c.expect}`);
  console.log(`  Actual:   ${status} ${text || "(empty body)"}`);
}

console.log(`\n${cases.length - failed}/${cases.length} cases match the contract (${BASE})`);
process.exit(failed ? 1 : 0);

// Contract tests for POST /api/orders (API and Data Design Workshop).
//
// Usage:
//   node scripts/test-orders.mjs                         # http://localhost:3000
//   node scripts/test-orders.mjs https://your-site.app   # any deployed build
//
// Signs up a fresh fictional customer, then sends each order request with that
// session (except the anonymous cases), prints the request and response, and
// compares the response to the intended contract. Exit code is 1 if any case fails.

import { createClient, createReporter, uniqueEmail } from "./lib/client.mjs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const customer = createClient(BASE);
const anon = createClient(BASE);
const r = createReporter();

// A correctly priced line: Margherita 14" (13.50 + 4.00) + 1 add-on (1.50) = 19.00.
const validLine = {
  menuItemId: "pizza-margherita",
  size: '14"',
  crust: "Thin",
  toppings: ["Garlic"],
  qty: 2,
};
const validOrder = { mode: "pickup", storeId: "store-downtown", items: [validLine] };
const isOrderId = (v) => typeof v === "string" && /^SS-\d{6}$/.test(v);
const errorMentions = (res, re) => re.test(res.json?.error ?? "");

const signup = await customer.request("POST", "/api/auth/signup", {
  body: { name: "Order Tester", email: uniqueEmail("orders"), password: "test-pass-123" },
});
if (signup.status !== 201) {
  console.error(`Setup failed: could not create a test account (${signup.status} ${signup.text})`);
  process.exit(2);
}
console.log("Setup: signed up a fictional test customer for the signed-in cases.");

const post = (client, body, raw) => client.request("POST", "/api/orders", { body, raw });

// 1 Successful action
let res = await post(customer, validOrder);
const placed = res.json;
r.check(
  "1 Successful action",
  "Valid pickup order from a signed-in customer",
  "201 with id, status received, server-computed prices, no echoed input",
  res,
  res.status === 201 &&
    isOrderId(placed?.id) &&
    placed.status === "received" &&
    placed.items?.[0]?.unitPrice === 19 &&
    placed.subtotal === 38 &&
    !("echo" in placed),
);

res = await customer.request("GET", `/api/orders/${placed?.id}`);
r.check(
  "1 Successful action",
  "Saved order can be read back (persistence)",
  "200 with the same id, status and subtotal",
  res,
  res.status === 200 && res.json?.id === placed?.id && res.json?.subtotal === 38,
);

// 2 Invalid input
res = await post(customer, { mode: "pickup", storeId: "store-downtown" });
r.check("2 Invalid input", "Missing items", "400 naming the items field", res,
  res.status === 400 && errorMentions(res, /items/));

res = await post(customer, { ...validOrder, items: [{ ...validLine, qty: "two" }] });
r.check("2 Invalid input", "Wrong type: qty is a string", "400 naming qty", res,
  res.status === 400 && errorMentions(res, /qty/));

res = await post(customer, { ...validOrder, items: [{ ...validLine, size: '99"' }] });
r.check("2 Invalid input", "Unacceptable value: size not offered for this item", "400 naming size", res,
  res.status === 400 && errorMentions(res, /size/));

res = await post(customer, undefined, "{ not json");
r.check("2 Invalid input", "Malformed JSON body", "400 invalid JSON", res, res.status === 400);

// 3 Access boundary
res = await post(anon, validOrder);
r.check("3 Access boundary", "Anonymous visitor tries to place an order", "401, sign-in required", res,
  res.status === 401);

res = await anon.request("GET", "/api/orders");
r.check("3 Access boundary", "Anonymous visitor tries to list orders", "401, sign-in required", res,
  res.status === 401);

res = await post(customer, { ...validOrder, id: "SS-000001", status: "delivered" });
r.check(
  "3 Access boundary",
  "Customer tries to set server-owned fields (id, status)",
  "400 rejecting the unexpected fields; client cannot choose id or status",
  res,
  res.status === 400 && errorMentions(res, /id|status/),
);

// 4 Edge cases
res = await post(customer, { ...validOrder, items: [{ ...validLine, unitPrice: 0.01 }] });
r.check("4 Edge case", "Tampered price: client sends unitPrice 0.01",
  "400; prices come from the menu, never from the client", res,
  res.status === 400 && errorMentions(res, /unitPrice/));

res = await post(customer, { ...validOrder, storeId: "store-atlantis" });
r.check("4 Edge case", "Nonexistent store", "422 unknown store", res,
  res.status === 422 && errorMentions(res, /store/i));

res = await post(customer, { ...validOrder, mode: "delivery", storeId: "store-wicker" });
r.check("4 Edge case", "Delivery from a pickup-only store (store-wicker)", "422 store does not offer delivery", res,
  res.status === 422 && errorMentions(res, /deliver/i));

res = await post(customer, { ...validOrder, items: [] });
r.check("4 Edge case", "Empty cart", "422 order must contain at least one item", res,
  res.status === 422 && errorMentions(res, /item/));

r.finish(BASE);

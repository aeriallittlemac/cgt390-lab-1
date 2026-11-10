// Access-control tests for the checkout flow: can one customer see or change
// another customer's order by calling the API directly, bypassing the UI?
//
// Usage (local or isolated builds only; it creates fictional accounts and orders):
//   node scripts/test-access-control.mjs                         # http://localhost:3000
//   node scripts/test-access-control.mjs http://localhost:3100
//
// Account A places a delivery order. Account B, a different signed-in customer,
// then tries to read, list, track, edit, cancel, delete and re-own that order.
// Every attempt should be refused, and A's order should be unchanged afterwards.
// Evidence is printed with session cookies redacted. Exit code is 1 if any case fails.

import { createClient, createReporter, uniqueEmail } from "./lib/client.mjs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const accountA = createClient(BASE);
const accountB = createClient(BASE);
const anon = createClient(BASE);
const r = createReporter();

const SENT_AS_B = "Sent with Cookie: session=<redacted> (Account B's own valid session)";
const SENT_AS_A = "Sent with Cookie: session=<redacted> (Account A's session)";

// ---------- Setup ----------

async function signUp(client, name, tag) {
  const res = await client.request("POST", "/api/auth/signup", {
    body: { name, email: uniqueEmail(tag), password: "test-pass-123" },
  });
  if (res.status !== 201) {
    console.error(`Setup failed: could not create ${name} (${res.status} ${res.text})`);
    process.exit(2);
  }
  return res.json.user;
}

const userA = await signUp(accountA, "Test Account A", "access-a");
const userB = await signUp(accountB, "Test Account B", "access-b");
console.log(`Setup: signed up two fictional customers, A (${userA.email}) and B (${userB.email}).`);

let res = await accountA.request("POST", "/api/orders", {
  body: {
    mode: "delivery",
    storeId: "store-downtown",
    items: [{ menuItemId: "pizza-pepperoni", size: '18"', crust: "Classic", toppings: ["Jalapeno"], qty: 1 }],
  },
});
if (res.status !== 201) {
  console.error(`Setup failed: Account A could not place an order (${res.status} ${res.text})`);
  process.exit(2);
}
const orderA = res.json;
const ORDER = `/api/orders/${orderA.id}`;
console.log(`Setup: Account A placed order ${orderA.id} (status "${orderA.status}", subtotal ${orderA.subtotal}).`);

// ---------- Control: the owner can see their own order ----------

res = await accountA.request("GET", ORDER);
r.check("0 Control", "Account A views its own order", "200 with the order", res,
  res.status === 200 && res.json?.id === orderA.id, SENT_AS_A);

// ---------- 1 Read A's order as B ----------

res = await accountB.request("GET", ORDER);
const notFoundBody = res.text;
r.check("1 View", "Account B requests Account A's order by id", "404, same as a missing order; no order data", res,
  res.status === 404 && !res.text.includes(orderA.id) && !/pepperoni/i.test(res.text), SENT_AS_B);

res = await accountB.request("GET", "/api/orders/SS-000000");
r.check("1 View", "Account B requests an order id that doesn't exist", "404 with the identical body (ids can't be probed)", res,
  res.status === 404 && res.text === notFoundBody, SENT_AS_B);

res = await accountB.request("GET", "/api/orders");
r.check("1 View", "Account B lists orders", "200 with only B's orders (none), not A's", res,
  res.status === 200 && Array.isArray(res.json?.orders) && !res.json.orders.some((o) => o.id === orderA.id), SENT_AS_B);

res = await accountB.request("GET", `/tracker?id=${encodeURIComponent(orderA.id)}`);
// React separates text pieces with <!-- --> markers in the HTML; drop them before matching.
const page = res.text.replaceAll("<!-- -->", "");
const saysNotFound = page.includes(`No order ${orderA.id} on your account`);
const leaksOrder = page.includes(`Status of order ${orderA.id}`) || /Pepperoni|Jalapeno/.test(page);
r.check("1 View", "Account B opens the tracker page for A's order", "200 page saying the order isn't on B's account, no status steps or order details", {
  ...res,
  text: saysNotFound ? `(HTML page) "No order ${orderA.id} on your account."` : `(HTML page, ${res.text.length} chars)`,
}, res.status === 200 && saysNotFound && !leaksOrder, SENT_AS_B);

// ---------- 2 Modify A's order as B ----------

res = await accountB.request("PATCH", ORDER, { body: { status: "making" } });
r.check("2 Modify", "Account B advances A's order status", "403 (only staff can change status)", res, res.status === 403, SENT_AS_B);

res = await accountB.request("PATCH", ORDER, { body: { address: "742 Example Ave, Test City" } });
r.check("2 Modify", "Account B changes A's delivery address", "403, refused before the body is read", res, res.status === 403, SENT_AS_B);

res = await accountB.request("PATCH", ORDER, { body: { status: "cancelled" } });
r.check("2 Modify", "Account B cancels A's order via PATCH", "403", res, res.status === 403, SENT_AS_B);

res = await accountB.request("DELETE", ORDER);
r.check("2 Modify", "Account B deletes A's order", "405, there is no delete route", res, res.status === 405, SENT_AS_B);

res = await accountB.request("PUT", ORDER, { body: { address: "742 Example Ave, Test City" } });
r.check("2 Modify", "Account B replaces A's order via PUT", "405, there is no replace route", res, res.status === 405, SENT_AS_B);

res = await accountB.request("POST", "/api/orders", {
  body: {
    userId: userA.id,
    mode: "pickup",
    storeId: "store-downtown",
    items: [{ menuItemId: "drink-soda", size: "20 oz", crust: "", toppings: [], qty: 1 }],
  },
});
r.check("2 Modify", "Account B places an order on A's account (userId in body)", "400, unexpected field: userId", res,
  res.status === 400 && /userId/.test(res.json?.error ?? ""), SENT_AS_B);

res = await accountB.request("PATCH", ORDER, { body: { status: "making" }, headers: { Origin: "https://attacker.example" } });
r.check("2 Modify", "Cross-site PATCH riding on B's cookie", "403 cross-site request rejected", res,
  res.status === 403 && /cross-site/i.test(res.json?.error ?? ""), SENT_AS_B);

// ---------- 3 No session at all ----------

res = await anon.request("GET", ORDER);
r.check("3 Anonymous", "No cookie: view A's order", "401", res, res.status === 401, "Sent with no Cookie header");

res = await anon.request("PATCH", ORDER, { body: { status: "making" } });
r.check("3 Anonymous", "No cookie: change A's order", "401", res, res.status === 401, "Sent with no Cookie header");

// ---------- 4 A's order afterwards ----------

res = await accountA.request("GET", ORDER);
const after = res.json;
const unchanged =
  res.status === 200 &&
  after?.status === orderA.status &&
  after?.subtotal === orderA.subtotal &&
  JSON.stringify(after?.items) === JSON.stringify(orderA.items) &&
  !("address" in (after ?? {}));
r.check("4 Integrity", "Account A's order after all of B's attempts", `200, still "${orderA.status}", same items and subtotal`, res,
  unchanged, SENT_AS_A);

r.finish(BASE);

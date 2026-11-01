// Authentication and authorization tests.
//
// Usage:
//   node scripts/test-auth.mjs                         # http://localhost:3000
//   node scripts/test-auth.mjs https://your-site.app   # staff cases are skipped
//
// Simulates four people with separate cookie jars: two customers (A and B), a
// staff member, and an anonymous visitor. All accounts are fictional and use a
// unique email per run. Staff cases promote the staff account with
// scripts/make-staff.mjs, so they only run against a local server.

import { execFileSync } from "node:child_process";
import { createClient, createReporter, uniqueEmail } from "./lib/client.mjs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE);
const r = createReporter();

const a = createClient(BASE);
const b = createClient(BASE);
const staff = createClient(BASE);
const anon = createClient(BASE);

const PASSWORD = "test-pass-123";
const emailA = uniqueEmail("customer-a");
const emailB = uniqueEmail("customer-b");
const emailStaff = uniqueEmail("staff");
const order = {
  mode: "delivery",
  storeId: "store-downtown",
  items: [{ menuItemId: "pizza-pepperoni", size: '10"', crust: "Classic", toppings: [], qty: 1 }],
};
const err = (res) => res.json?.error ?? "";

// ---------- Authentication ----------
const G1 = "Authentication";

let res = await a.request("POST", "/api/auth/signup", {
  body: { name: "Customer A", email: emailA, password: PASSWORD },
});
r.check(G1, "Sign up with valid details", "201 with public user fields only; HttpOnly SameSite=Lax session cookie", res,
  res.status === 201 &&
    res.json?.user?.role === "customer" &&
    !/password/i.test(res.text) &&
    /HttpOnly/i.test(res.setCookie ?? "") &&
    /SameSite=lax/i.test(res.setCookie ?? ""));

res = await anon.request("POST", "/api/auth/signup", {
  body: { name: "Copycat", email: emailA.toUpperCase(), password: PASSWORD },
});
r.check(G1, "Sign up again with the same email in different case", "409, emails are unique regardless of case", res,
  res.status === 409);

res = await anon.request("POST", "/api/auth/signup", {
  body: { name: "Shorty", email: uniqueEmail("short"), password: "abc" },
});
r.check(G1, "Sign up with a 3-character password", "400 password length rule", res,
  res.status === 400 && /password/.test(err(res)));

res = await anon.request("POST", "/api/auth/signup", {
  body: { name: "Sneaky", email: uniqueEmail("sneaky"), password: PASSWORD, role: "staff" },
});
r.check(G1, "Sign up while trying to set role: staff", "400 unexpected field; nobody can grant themselves staff", res,
  res.status === 400 && /role/.test(err(res)));

res = await anon.request("POST", "/api/auth/login", { body: { email: emailA, password: "wrong-pass-999" } });
const wrongPasswordMsg = err(res);
r.check(G1, "Log in with the wrong password", "401 generic message", res, res.status === 401);

res = await anon.request("POST", "/api/auth/login", {
  body: { email: uniqueEmail("nobody"), password: PASSWORD },
});
r.check(G1, "Log in with an email that has no account", "401 with the same message as a wrong password", res,
  res.status === 401 && err(res) === wrongPasswordMsg,
  "Identical responses mean the login form can't be used to discover who has an account.");

res = await anon.request("GET", "/api/auth/me");
r.check(G1, "Who am I, with no cookie", "401", res, res.status === 401);

const forged = createClient(BASE);
forged.cookie = "session=made-up-token-value";
res = await forged.request("GET", "/api/auth/me");
r.check(G1, "Who am I, with a forged session cookie", "401, the token isn't in the sessions table", res,
  res.status === 401);

// Log in as A from a second "device", then log that device out and replay its cookie.
const device = createClient(BASE);
res = await device.request("POST", "/api/auth/login", { body: { email: emailA, password: PASSWORD } });
r.check(G1, "Log in with the correct password", "200 with the user and a new session cookie", res,
  res.status === 200 && res.json?.user?.email === emailA && Boolean(res.setCookie));
const stolenCookie = device.cookie;

res = await device.request("POST", "/api/auth/logout");
r.check(G1, "Log out", "204 and the cookie is cleared", res, res.status === 204);

const replay = createClient(BASE);
replay.cookie = stolenCookie;
res = await replay.request("GET", "/api/auth/me");
r.check(G1, "Reuse the logged-out session cookie", "401, logging out revoked the session on the server", res,
  res.status === 401);

res = await a.request("GET", "/api/auth/me");
r.check(G1, "Customer A's other session still works", "200, logging out one device doesn't affect others", res,
  res.status === 200 && res.json?.user?.email === emailA);

const target = uniqueEmail("locked");
const attacker = createClient(BASE);
for (let i = 0; i < 5; i++) {
  await attacker.request("POST", "/api/auth/login", { body: { email: target, password: `guess-${i}` } });
}
res = await attacker.request("POST", "/api/auth/login", { body: { email: target, password: "guess-6" } });
r.check(G1, "Sixth failed login for one email within 15 minutes", "429 with a Retry-After header", res,
  res.status === 429 && Number(res.retryAfter) > 0, `Retry-After: ${res.retryAfter}`);

res = await a.request("POST", "/api/orders", { body: order, headers: { Origin: "https://evil.example" } });
r.check(G1, "Cross-site request carrying A's cookie (CSRF)", "403, Origin doesn't match this site", res,
  res.status === 403);

// ---------- Authorization ----------
const G2 = "Authorization";

res = await a.request("POST", "/api/orders", { body: order });
const orderId = res.json?.id;
r.check(G2, "Customer A places an order", "201, order saved with A as owner", res,
  res.status === 201 && /^SS-\d{6}$/.test(orderId ?? ""));

res = await a.request("GET", `/api/orders/${orderId}`);
r.check(G2, "Customer A reads their own order", "200", res, res.status === 200 && res.json?.id === orderId);

await b.request("POST", "/api/auth/signup", { body: { name: "Customer B", email: emailB, password: PASSWORD } });
res = await b.request("GET", `/api/orders/${orderId}`);
r.check(G2, "Customer B reads A's order by id", "404, same as a missing order, so ids can't be probed", res,
  res.status === 404);

res = await b.request("GET", "/api/orders");
r.check(G2, "Customer B lists orders", "200 with only B's orders (none), never A's", res,
  res.status === 200 && Array.isArray(res.json?.orders) && !res.json.orders.some((o) => o.id === orderId));

res = await anon.request("GET", `/api/orders/${orderId}`);
r.check(G2, "Anonymous visitor reads A's order", "401", res, res.status === 401);

res = await a.request("PATCH", `/api/orders/${orderId}`, { body: { status: "delivered" } });
r.check(G2, "Customer A marks their own order delivered", "403, only staff can change status", res,
  res.status === 403);

res = await anon.request("GET", "/account");
r.check(G2, "Anonymous visitor opens /account", "307 redirect to /login?next=/account", res,
  res.status === 307 && /\/login\?next=%2Faccount/.test(res.location ?? ""));

res = await a.request("GET", "/login?next=https://evil.example");
r.check(G2, "Signed-in user opens /login?next=https://evil.example", "307 to /account, never off-site", res,
  res.status === 307 && (res.location ?? "").endsWith("/account"));

if (!isLocal) {
  r.note("Staff cases need scripts/make-staff.mjs on the server; run against localhost to include them.");
} else {
  await staff.request("POST", "/api/auth/signup", {
    body: { name: "Staff Member", email: emailStaff, password: PASSWORD },
  });
  execFileSync(process.execPath, ["scripts/make-staff.mjs", emailStaff], { stdio: "ignore" });

  res = await staff.request("GET", `/api/orders/${orderId}`);
  r.check(G2, "Staff reads A's order", "200, staff can see every order", res,
    res.status === 200 && res.json?.id === orderId);

  res = await staff.request("PATCH", `/api/orders/${orderId}`, { body: { status: "making" } });
  r.check(G2, "Staff moves A's order received → making", "200 with status making", res,
    res.status === 200 && res.json?.status === "making");

  res = await staff.request("PATCH", `/api/orders/${orderId}`, { body: { status: "delivered" } });
  r.check(G2, "Staff skips making → delivered", "409, status can only move one step forward", res,
    res.status === 409);

  res = await staff.request("PATCH", `/api/orders/${orderId}`, { body: { status: "eaten" } });
  r.check(G2, "Staff sets an unknown status", "400 listing the allowed statuses", res, res.status === 400);

  res = await a.request("GET", `/api/orders/${orderId}`);
  r.check(G2, "Customer A sees the staff update", "200 with status making (persisted)", res,
    res.status === 200 && res.json?.status === "making");
}

r.finish(BASE);

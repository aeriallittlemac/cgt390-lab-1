// User-input tests beyond the order contract cases in test-orders.mjs.
// Written against the session-start code (commit 9c4cac1) and runnable against
// any later version, so the same cases show what changed.
//
// Usage:
//   node scripts/test-inputs.mjs                         # http://localhost:3000
//   node scripts/test-inputs.mjs http://localhost:3002   # e.g. a baseline checkout
//
// If the server has sign-up (/api/auth/signup), a fictional customer is created
// so order requests get past the sign-in check and reach input validation.
//
// Three geocode cases call OpenStreetMap's Nominatim through /api/geocode.
// They are spaced 1.1 s apart to respect its one-request-per-second policy;
// repeat runs within an hour are served from the route's cache.

import { createClient, createReporter, uniqueEmail } from "./lib/client.mjs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const user = createClient(BASE);
const r = createReporter();
const pause = (ms) => new Promise((done) => setTimeout(done, ms));

const signup = await user.request("POST", "/api/auth/signup", {
  body: { name: "Input Tester", email: uniqueEmail("inputs"), password: "test-pass-123" },
});
console.log(
  signup.status === 201
    ? "Setup: server has accounts; signed up a fictional customer for the order cases."
    : `Setup: no sign-up on this server (${signup.status}); order cases run anonymously.`,
);

const line = { menuItemId: "drink-soda", size: "20 oz", crust: "", toppings: [], qty: 1 };
const order = { mode: "pickup", storeId: "store-downtown", items: [line] };
const post = (opts) => user.request("POST", "/api/orders", opts);
const rejected = (res) => res.status >= 400 && res.status < 500;

// ---------- POST /api/orders ----------
const O = "Orders";

let res = await post({ raw: "[]" });
r.check(O, "Body is a JSON array instead of an object", "400", res, res.status === 400);

res = await post({ raw: '"hello"' });
r.check(O, "Body is a bare JSON string", "400", res, res.status === 400);

res = await post({ body: { ...order, items: [{ ...line, qty: -3 }] } });
r.check(O, "Negative quantity (qty: -3)", "400 naming qty", res,
  res.status === 400 && /qty/.test(res.json?.error ?? ""));

const bigNote = "x".repeat(1_000_000);
res = await post({ body: { ...order, note: bigNote } });
r.check(O, "1 MB body (an extra 'note' field of 1,000,000 characters)",
  "Rejected (4xx) without sending the megabyte back", res,
  rejected(res) && res.text.length < 10_000, `Response size: ${res.text.length} characters`);

res = await post({
  body: order,
  headers: { "Content-Type": "text/plain", Origin: "https://evil.example" },
});
r.check(O, "Cross-site 'simple' POST: Content-Type text/plain from another origin",
  "Rejected (403 or 415); browsers send this kind of request without a CORS preflight", res,
  res.status === 403 || res.status === 415);

res = await post({ body: { ...order, items: [{ ...line, toppings: ["<script>alert(1)</script>"] }] } });
r.check(O, "HTML/script text inside a field",
  "Never returned as an HTML page (Content-Type must be JSON)", res,
  /application\/json/.test(res.contentType ?? ""), `Content-Type: ${res.contentType}`);

const first = await post({ body: order });
res = await post({ body: order });
r.check(O, "Duplicate submission: the same order sent twice in a row",
  "Second request rejected (409) or answered with the first order's id", res,
  res.status === 409 || (res.json?.id && res.json.id === first.json?.id),
  `First id ${first.json?.id ?? first.status}, second id ${res.json?.id ?? res.status}`);

const ids = [];
let last = res;
for (let i = 0; i < 200; i++) {
  last = await post({ body: order });
  if (last.json?.id) ids.push(last.json.id);
}
const unique = new Set(ids).size;
const repeats = ids.filter((id, i) => ids.indexOf(id) !== i);
// One summary line instead of 200 responses; the status shown is the last request's real status.
const idCheck = {
  ...last,
  text: `${ids.length} orders placed, ${unique} distinct ids${repeats.length ? `; repeated: ${[...new Set(repeats)].join(", ")}` : ""}`,
  setCookie: null,
  location: null,
  sent: { method: "POST", path: "/api/orders", body: "(the same valid order, 200 times)" },
};
r.check(O, "Order number uniqueness across 200 orders", "200 distinct order numbers", idCheck,
  ids.length === 200 && unique === 200,
  "With 4-digit numbers (9,000 possibilities) a repeat in 200 orders is ~89% likely; it varies run to run.");

// ---------- GET /api/geocode ----------
const G = "Geocode";

res = await user.request("GET", "/api/geocode?q=ab");
r.check(G, "Search shorter than 3 characters", "200 with an empty list, no upstream call", res,
  res.status === 200 && res.text === "[]");

res = await user.request("GET", "/api/geocode?lat=abc&lng=xyz");
r.check(G, "Coordinates that aren't numbers (lat=abc, lng=xyz)", "400 before contacting Nominatim", res,
  res.status === 400);
await pause(1100);

res = await user.request("GET", "/api/geocode?lat=999&lng=999");
r.check(G, "Coordinates outside the planet (lat=999, lng=999)", "400 before contacting Nominatim", res,
  res.status === 400);
await pause(1100);

res = await user.request("GET", `/api/geocode?q=${"pizza ".repeat(500)}`);
r.check(G, "3,000-character search query", "400 (too long) before contacting Nominatim", res,
  res.status === 400);

// ---------- GET /api/deals and /api/menu ----------
const D = "Deals and menu";
const today = new Date().toISOString().slice(0, 10);

res = await user.request("GET", "/api/deals");
const expired = (res.json ?? []).filter((d) => d.expiresAt < today).map((d) => `${d.id} (${d.expiresAt})`);
r.check(D, "Public deals list excludes expired deals", `200 with no deal whose expiresAt is before ${today}`, res,
  res.status === 200 && expired.length === 0, expired.length ? `Expired but listed: ${expired.join(", ")}` : "");

res = await user.request("POST", "/api/menu", { body: { id: "free-pizza", basePrice: 0 } });
r.check(D, "Try to add a menu item through the API", "405, the menu is read-only", res, res.status === 405);

r.finish(BASE);

# Checkout security tests: access control and form handling

Both tests ran on 2026-11-10 against an isolated local copy of the prototype, with fictional
accounts (`@example.test`) and no payment data. Session cookies appear as `session=<redacted>`.

**Shared environment:** Windows 11, Node 24.20, Next.js 16.3.3 production build
(`next start -p 3100`). Each run used a fresh SQLite (libSQL) database file in a temporary folder,
deleted afterwards. The code under test is the uncommitted working tree on `main` (commit `b430a07`
plus the libSQL database changes). **The deployed Vercel site was not tested**; its sign-in is
currently broken by a separate database issue.

---

## Test 1: Access control (one customer vs. another customer's order)

**Rule and expected result**
A signed-in customer can view only their own orders and cannot change, cancel, delete or re-own
anyone's order. Requests about another customer's order should get a **404** identical to a
missing order (so order ids can't be probed). Changes should get **403**, or **405** where no
route exists. Requests with no session should get **401**, and cross-site requests **403**.
The owner's order should be unchanged afterwards.

**Steps and environment**
1. Signed up Account A and Account B, each with its own session cookie.
2. A placed a delivery order (`SS-166864`: 18" Pepperoni + Jalapeno, subtotal $24.50). A viewed it: 200 (control).
3. Using B's own valid session, sent 13 requests straight to the API and tracker page, bypassing the UI.
4. A fetched the order again to check it was unchanged.

Script: `scripts/test-access-control.mjs`. Full output: `workshop/results-access-control.txt`.

**Actual result and evidence (redacted)** — 15/15 cases passed

| Request (Cookie: session=&lt;redacted&gt;, Account B) | Response |
|---|---|
| `GET /api/orders/SS-166864` | 404 `{"error":"Order not found"}` |
| `GET /api/orders/SS-000000` (doesn't exist) | 404, byte-identical body |
| `GET /api/orders` | 200 `{"orders":[]}` |
| `GET /tracker?id=SS-166864` | 200 page: "No order SS-166864 on your account." (no status or items) |
| `PATCH …/SS-166864` `{"status":"making"}` / `{"status":"cancelled"}` / `{"address":"…"}` | 403 `Only staff can update order status` (all three) |
| `DELETE …/SS-166864`, `PUT …/SS-166864` | 405, empty body |
| `POST /api/orders` with `"userId":"<A's id>"` | 400 `Unexpected field(s): userId` |
| `PATCH …` with `Origin: https://attacker.example` | 403 `Cross-site request rejected` |
| `GET` / `PATCH …/SS-166864` with **no cookie** | 401 |
| A: `GET /api/orders/SS-166864` afterwards | 200, still `received`, same items and subtotal |

**What the result supports**
For the routes tested, the server enforces ownership itself rather than relying on the UI.
Another customer can't read, list, track, modify or reassign an order, and can't tell whether an
order id exists. The checks are in `lib/orderStore.ts` (`getOrderFor`, `listOrdersFor`) and the
staff-role check in `app/api/orders/[id]/route.ts`.

**Caveats**
- ⚠ **Staff weren't tested.** Any staff account can view and advance *every* order across all
  stores. That's by design, but there's no per-store limit.
- ⚠ **Address change and cancel are blocked partly because those features don't exist.** No route
  edits addresses or cancels orders, and delivery addresses aren't stored at all. Retest when
  those features are added.
- ⚠ **"Unchanged" was checked through the API**, using A's `GET`, not by reading the database
  directly. Test 2 below does check the database.
- ⚠ **The cross-site test only sent a forged `Origin` header.** It doesn't show browser
  `SameSite` cookie behavior, because the test client isn't a browser.
- ⚠ **The first run reported 14/15.** The tracker case failed because of the test's own text
  matching (React inserts `<!-- -->` markers around the order id), not the app. The HTML B received
  was checked by hand: it showed "not found" and contained no order details. The check was fixed
  and the rerun passed.
- **Not tested:** the auth routes (`/api/auth/*`), session expiry and reuse after sign-out, timing
  differences between "not yours" and "doesn't exist", and the deployed site.

---

## Test 2: Form handling (invalid checkout payloads)

**Rule and expected result**
`POST /api/orders` should reject any invalid payload with **400** (malformed: missing field,
wrong type, unknown field) or **422** (business rule: empty order, unknown store, service not
offered), with an error that names the problem. **No row should be written** to `orders` or
`order_items`. Prices, totals, status and order id belong to the server, so the client can't
set them.

**Steps and environment**
1. Signed up one fictional customer.
2. Sent one **valid** order as a control: expected 201, with exactly one order and one item written.
3. Sent 29 invalid payloads straight to the API: missing fields, bad quantities, unsupported
   toppings/sizes/items/stores, tampered prices and server-owned fields, and malformed bodies.
4. Read the order tables (read-only) **before and after every request**, then checked every stored
   row against `menu.json`.

Script: `scripts/test-order-validation.mjs`. Full output: `workshop/results-order-validation.txt`.

**Actual result and evidence (redacted)** — 31/31 cases passed

| Payload (examples) | Response | DB orders / items |
|---|---|---|
| *Control:* valid 18" Pepperoni + Jalapeno | 201, `SS-430401`, stored at 2450¢ | 0/0 → 1/1 |
| Pizza with no `size` | 400 `items[0].size is required` | 1/1 → 1/1 |
| `qty: -2` (also `0`, `1.5`, `"2"`, `21`) | 400 `…qty must be a whole number from 1 to 20` | unchanged |
| Topping `Pineapple`; `Garlic` (another pizza's topping); a duplicate topping | 400, naming the topping or "duplicates" | unchanged |
| `menuItemId: "pizza-dessert"`; `category: "Desserts"` | 400 not on the menu / unexpected field | unchanged |
| Unknown store; delivery from a pickup-only store; `items: []` | 422 | unchanged |
| `unitPrice: 0.01`, `unitPrice: -24.5`, `lineTotal: 0`, `subtotal: 0.01` | 400 `Unexpected field(s): …` | unchanged |
| `status: "delivered"`, `id: "SS-000001"` | 400 `Unexpected field(s): …` | unchanged |
| Invalid JSON; body `[]`; `items` as a string | 400 | unchanged |

| | orders | order_items | invalid stored rows |
|---|---|---|---|
| **Before** | 0 | 0 | — |
| **After** | 1 (control only) | 1 | **0** |

**What the result supports**
The server validates every checkout field and rejects bad input before writing anything. In
`app/api/orders/route.ts`, `validateOrder` returns at line 19, before `saveOrder` at line 21.
The client can't set or influence prices: price fields are rejected as unknown, and the stored
subtotal is the server's own calculation from `menu.json`.

**Caveats**
- ⚠ **Only `POST /api/orders` was tested.** The status update route (`PATCH /api/orders/[id]`)
  and the auth forms validate input separately; they're partly covered in `scripts/test-inputs.mjs`.
- ⚠ **Almost every invalid order had a single line.** The case of one bad line among several good
  ones wasn't sent. The code validates all lines before saving, and saves an order and its items in
  one batch, but that wasn't tested by forcing a failure partway through a save.
- ⚠ **Duplicate submission isn't covered.** The same *valid* order sent twice still saves two
  orders; that's a known failing case in `test-inputs.mjs`.
- ⚠ **Only one price was checked** (2450¢). The test shows the client can't set prices, not that
  every menu combination is priced correctly.
- **Scope of the "nothing saved" check:** it covers the `orders` and `order_items` tables only.
  The isolated database had no other writers, so row-count changes can be attributed to the test.
  The invalid-row scan covered this customer's orders.
- **Not tested:** very large payloads (covered separately by `scripts/test-line-limits.mjs`) and
  the deployed site.

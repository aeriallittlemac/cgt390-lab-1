# API Routes and the POST /api/orders Data Path

## Scope

This document describes the code as it stood on October 30, 2026: commit `b430a07` plus the uncommitted auth, session and order-storage work. It covers:

1. every API route, and whether it reads or writes data
2. the routes that handle orders
3. the full path of a `POST /api/orders` request
4. the schema of every table that request uses
5. which parts of the order input the database checks, and which only the code checks

**Storage:** The app uses **SQLite**, through Node's built-in `node:sqlite` module. It is not Supabase. The database is a local file at `.data/slice-society.db`, set by `DATABASE_PATH` in `lib/db.ts:13`. There are no `.sql` or migration files. The schema is a SQL string in `lib/db.ts:15-57`, which runs with `CREATE TABLE IF NOT EXISTS` when the server first connects. As `lib/db.ts:9-11` notes, this file-based store won't keep data on serverless hosts such as Vercel.

## 1. All API routes

Nine route files handle 11 methods between them.

### Read-only

| Route | File | Method | What it does |
|---|---|---|---|
| `/api/menu` | `app/api/menu/route.ts` | GET | Returns the menu from `data/menu.json` (placeholder data). |
| `/api/deals` | `app/api/deals/route.ts` | GET | Returns the deals from `data/deals.json` (placeholder data). |
| `/api/geocode` | `app/api/geocode/route.ts` | GET | Sends an address search (`?q=`) or a coordinate lookup (`?lat=&lng=`) to OpenStreetMap's Nominatim service and returns up to 5 matches, cached for 1 hour. |
| `/api/auth/me` | `app/api/auth/me/route.ts` | GET | Returns the signed-in user, or 401. |
| `/api/orders` | `app/api/orders/route.ts:25` | GET | Lists orders: customers see their own, staff see all. |
| `/api/orders/[id]` | `app/api/orders/[id]/route.ts:8` | GET | Returns one order to its owner or to staff. Anyone else gets 404. |

### Write or change data

| Route | File | Method | What it does |
|---|---|---|---|
| `/api/auth/signup` | `app/api/auth/signup/route.ts` | POST | Creates a customer account and signs the user in. Returns 409 if the email is already taken. |
| `/api/auth/login` | `app/api/auth/login/route.ts` | POST | Checks the email and password (limited to 5 tries per 15 minutes per email), then replaces any old session with a new one. |
| `/api/auth/logout` | `app/api/auth/logout/route.ts` | POST | Deletes the current session. |
| `/api/orders` | `app/api/orders/route.ts:9` | POST | Checks and prices a new order on the server, then saves it under the signed-in user. |
| `/api/orders/[id]` | `app/api/orders/[id]/route.ts:18` | PATCH | Staff only: moves an order to its next status. |

All five write routes reject requests that come from other websites (`isCrossSite`).

**Exceptions to the read/write split:**

- `/api/geocode` stores results in an in-memory cache. That only speeds up repeat lookups and doesn't change app data.
- Any GET that checks who is signed in can delete one database row. If the session cookie points to an expired session, that session row is deleted (`lib/session.ts:52-54`). This is normal cleanup, so these routes still count as read-only.

## 2. Routes that handle orders

| Route | Method | Reads or writes |
|---|---|---|
| `/api/orders` | POST | Writes |
| `/api/orders` | GET | Reads |
| `/api/orders/[id]` | GET | Reads |
| `/api/orders/[id]` | PATCH | Writes (staff only) |

**Related, but not order routes:**

- `/api/menu`: the server prices orders from the same `data/menu.json`, but `lib/orders.ts` imports that file directly. Nothing calls `/api/menu` or `/api/deals`; the pages also import the JSON directly.
- `/api/auth/*`: every order route requires a signed-in user, so login and signup come first. They don't touch orders.

## 3. Path of a POST /api/orders request

0. **Proxy: not involved.** `proxy.ts:19` only runs on the `/account`, `/order`, `/tracker` and `/rewards` pages, not on `/api/*`.
1. **Entry point:** `app/api/orders/route.ts:9`, `POST(request)`.
2. **Cross-site check** (`route.ts:10`): `isCrossSite()` (`lib/http.ts:27-35`) compares the `Origin` and `Host` headers. If they don't match, `crossSiteResponse()` (`lib/http.ts:37`) returns **403**.
3. **Who is signed in** (`route.ts:12-13`): `getCurrentUser()` (`lib/dal.ts:10`) calls `getSessionUser()` (`lib/session.ts:37-57`), which:
   - reads the `session` cookie and hashes it (`session.ts:15`, `:38`)
   - reads `sessions` joined with `users` (`session.ts:41-47`)
   - deletes the session if it has expired (`session.ts:52-54`)
   - returns the user through `toPublicUser()` (`lib/users.ts:19-21`)

   If there is no user, the route returns **401** (`errorResponse()`, `lib/http.ts:6-8`).
4. **Parse the body** (`route.ts:15-16`): `readJson()` (`lib/http.ts:11-19`) returns **400** if the body isn't valid JSON.
5. **Validate and price** (`route.ts:18-19`): `validateOrder()` (`lib/orders.ts:52-122`) uses JSON files, not the database:
   - checks the order's fields (`:53-63`); malformed input gets **400**
   - checks that the store exists in `data/stores.json` and offers the chosen mode (`:65-69`); this business-rule failure gets **422**
   - returns **422** for an empty cart (`:70`)
   - checks each line against `data/menu.json` (`:73-105`)
   - prices each line with `unitPriceFor()` (`lib/pricing.ts:6-9`) and adds up the subtotal (`:107`, `:120`)
6. **Save** (`route.ts:21`): `saveOrder()` (`lib/orderStore.ts:83-118`) runs inside `transaction()` (`lib/db.ts:72-82`), so if any step fails, nothing is saved:
   - generates an ID like `SS-123456` and reads `orders` to retry if that ID already exists (`:88-90`)
   - inserts 1 row into `orders` with status `'received'` and the price in cents (`:92-95`)
   - inserts 1 row into `order_items` for each line (`:97-114`)
7. **Response:** **201** with the saved order.

| Data | Read | Written |
|---|---|---|
| `sessions` + `users` | ✅ | Deletes the session row only if it has expired |
| `orders` | ✅ (duplicate-ID check) | ✅ 1 row |
| `order_items` | — | ✅ 1 row per line |
| `data/stores.json`, `data/menu.json` | ✅ (files, not tables) | — |

## 4. Schema (`lib/db.ts:15-57`)

```sql
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'staff')),
  created_at    TEXT NOT NULL
);

-- id is the SHA-256 of the cookie token; the raw token is never stored.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS orders (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id),
  store_id       TEXT NOT NULL,
  mode           TEXT NOT NULL CHECK (mode IN ('delivery', 'pickup')),
  status         TEXT NOT NULL DEFAULT 'received'
                 CHECK (status IN ('received', 'making', 'baking', 'ready', 'out', 'delivered')),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  placed_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id, placed_at);

CREATE TABLE IF NOT EXISTS order_items (
  order_id         TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  line_no          INTEGER NOT NULL,
  menu_item_id     TEXT NOT NULL,
  name             TEXT NOT NULL,
  size             TEXT NOT NULL,
  crust            TEXT NOT NULL,
  toppings         TEXT NOT NULL, -- JSON array of strings
  qty              INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 20),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  PRIMARY KEY (order_id, line_no)
);
```

The order request reads only `id, name, email, role` from `users`. It never reads `password_hash`.

### Foreign keys

| From | To | On delete |
|---|---|---|
| `sessions.user_id` | `users.id` | CASCADE |
| `orders.user_id` | `users.id` | Default: a user who has orders can't be deleted |
| `order_items.order_id` | `orders.id` | CASCADE |

SQLite only enforces foreign keys when `PRAGMA foreign_keys = ON` is set for the connection. This project sets it at `lib/db.ts:62`.

### Notes on the schema

- `orders.store_id` and `order_items.menu_item_id` aren't foreign keys, because stores and menu items live in JSON files, not tables.
- SQLite treats a column type as a preference, not a rule, so it would accept text in an `INTEGER` column. Only the `CHECK`s and the code reject bad values here.
- Money is stored as whole cents. `saveOrder()` converts dollars to cents (`lib/orderStore.ts:28`).

## 5. Input contract vs. database constraints

Only two input rules are checked by the database: `mode` and the `qty` range. Every other rule is checked only in `validateOrder()`. One rule is checked nowhere.

| Contract rule | Checked in code (`lib/orders.ts`) | Checked by the database? |
|---|---|---|
| Body is a JSON object with no extra fields | ✅ `:53-56` | ❌ |
| `mode` is `delivery` or `pickup` | ✅ `:59-61` | ✅ `CHECK` |
| The store offers that mode | ✅ `:67-69` | ❌ |
| `storeId` is a non-empty string | ✅ `:62` | ⚠️ `NOT NULL` would still accept `''` |
| `storeId` exists | ✅ `:65-66` | ❌ not a foreign key |
| `items` is an array | ✅ `:63` | ❌ |
| `items` is not empty | ✅ `:70` | ❌ an order with no item rows is allowed |
| Each line is an object with no extra fields | ✅ `:75-78` | ❌ |
| `menuItemId` is on the menu | ✅ `:81`, `:91-92` | ⚠️ `NOT NULL` only |
| `size` is offered for the item | ✅ `:82`, `:93-95` | ⚠️ `NOT NULL` only |
| `crust` is optional (defaults to `""`) and offered for the item | ✅ `:80`, `:83`, `:96-98` | ⚠️ `NOT NULL` only |
| `toppings` is an array of strings | ✅ `:84-86` | ❌ stored as `TEXT` |
| Toppings are offered for the item, with no duplicates | ✅ `:99-105` | ❌ |
| `qty` is from 1 to 20 | ✅ `:87-89` | ✅ `CHECK` |
| `qty` is a whole number | ✅ `:87` | ❌ SQLite accepts `1.5` |
| Maximum number of lines per order | ❌ | ❌ |

### Fields the server fills in

| Field | Database constraint | What the database doesn't check |
|---|---|---|
| `user_id` | `NOT NULL`, foreign key to `users` | — |
| `status` | `DEFAULT 'received'` plus a `CHECK` on the allowed values | — |
| `subtotal_cents`, `unit_price_cents` | `CHECK (>= 0)` | That the subtotal equals the sum of `unit_price_cents × qty` |
| `name` | `NOT NULL` | That it matches the menu item |
| `(order_id, line_no)` | Primary key | — |

## 6. Gaps found

1. **There's no limit on the number of lines.** Each line is capped at 20, but a request with 10,000 lines would pass and insert 10,000 rows. Request size isn't limited either. This is the only rule enforced nowhere. Suggested fix: return 422 when `items.length` is over a limit such as 50, next to `lib/orders.ts:70`, and add a test in `scripts/test-orders.mjs`.
2. **The limit of 20 is written in two places**, `MAX_QTY` (`lib/orders.ts:13`) and the `CHECK` (`lib/db.ts:53`). If someone changes one and not the other, orders above the database's limit would pass validation and then fail on insert with a 500 error instead of a clear 400.
3. **There are no foreign keys for stores or menu items.** If an item is removed from `menu.json`, old orders keep a `menu_item_id` with nothing to link it to. Each order line still stores its own name and price, so old orders remain readable.
4. **Error messages repeat unchecked input.** `storeId` and `menuItemId` appear in error text (`lib/orders.ts:66`, `:92`) with no length limit, so a very long ID makes a very long response. This is minor.

**Conclusion:** the code does almost all of the checking. The database `CHECK`s on `mode`, `qty` and `status` only matter if something writes to the tables without going through `saveOrder()`, and right now nothing does.

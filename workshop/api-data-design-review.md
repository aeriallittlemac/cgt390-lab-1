# Pizza Ordering Prototype: Data Model and API Design Review

## Scope and evidence

This review looks at the prototype as it stood before the Thursday, October 22 session. The two commits from that day (`c336cee` contract tests, `b430a07` server validation) are the fixes, so the "before" snapshot is commit `9c4cac1` (October 8). Every finding can be reproduced with `git show 9c4cac1:<file>`.

The review uses the lecture's three-tier model: the browser asks, the server checks, and the database enforces and stores. At `9c4cac1`, only the browser tier worked.

## 1. Evidence of poor system design at 9c4cac1

### No data model, only types (slides 7–8)

- `PLAN.md` section 1: "No database… Order and Reward records are fixtures."
- The cart lives only in browser `localStorage` (`lib/storage.ts`, key `pizza.cart`), so the customer and kitchen can never see the same record.
- `app/api/orders/route.ts` creates an order and forgets it ("No persistence").
- `app/tracker/page.tsx` makes up the status from the *length* of the typed order number, so any text "tracks."

### Identity (slide 28; slide 43 "Identity" row)

- `Order` in `lib/types.ts` has no customer field: `{ id, storeId, mode, items, status, placedAt }`.
- `Reward` (`{ points, tier, history[] }`) has no user id, and its history entries don't link to orders.
- `AuthButton.tsx` is a stub. No identity means no authorization is possible.

### Request validation (slide 18: syntax → schema → business rules)

- Syntax: an empty `catch {}` accepts invalid JSON on purpose.
- Schema: the body is never checked. Missing items, `qty: "two"`, `size: '99"'` and `coupon: "FREE"` all returned 200.
- Business rules exist only in the browser:
  - The topping price is hardcoded at `ItemCustomizer.tsx` lines 43–44 (`toppings.length * 1.5`) and isn't in `menu.json`, so the server couldn't check it.
  - The delivery fee and tax exist only in `CartSummary.tsx`. The cart charges $2.99 delivery even for pickup, and `/order` shows only the subtotal, so the customer sees two different totals.

### Status codes (slide 21; slide 43 "Status codes" row)

- The order route returns 200 for everything: no 400/401/404/409/422, and 200 where 201 Created is correct.
- `/api/geocode` returns `[]` with 200 when the upstream service fails, so "no results" and "service down" look the same (slide 25: "Empty is not an error").

### Response design (slides 19–20; slide 43 "Response" row)

- `echo: body` returns whatever was sent, including extra fields.
- Order ids are `SS-` plus 4 random digits: 9,000 possible, never checked for duplicates.

### Data the server can't enforce

- Store hours are free text (`"11:00 AM – 11:00 PM"`) with no timezone.
- Deal rules are prose ("Every Tuesday", "Weekdays 11am–2pm"). `expiresAt` has no time or timezone, and deal codes are never validated or redeemed.
- `OrderStatus` allows a pickup order to be "out for delivery."
- `Order.items` reuses `CartItem`, which carries a client-supplied `name` and `unitPrice`.

## 2. Recommended data tables

Money is stored as integer cents to avoid rounding errors.

| Table | Key columns | Constraint / purpose |
|---|---|---|
| users | id, email, password_hash, name, role, created_at | UNIQUE(email); role is customer or staff |
| sessions | id, user_id, expires_at | The server reads identity here, never from the request body |
| stores | id, name, address, lat, lng, timezone, offers_delivery, offers_pickup, delivery_radius_km | A timezone makes "open now" checkable |
| store_hours | store_id, weekday, opens_at, closes_at | Replaces the free-text hours string |
| menu_items | id, name, category, description, image, base_price_cents, active | `active` retires an item without breaking old orders |
| menu_item_sizes | menu_item_id, label, price_delta_cents | UNIQUE(menu_item_id, label): a 99" pizza becomes impossible |
| toppings / menu_item_toppings | id, name, price_cents | Moves the hardcoded $1.50 out of the browser |
| deals | id, code, discount_type, discount_value, starts_at, expires_at, min_size, valid_weekdays | UNIQUE(code); prose rules become columns |
| deal_items | deal_id, menu_item_id | Replaces the `appliesTo[]` array |
| orders | id, user_id (nullable for guests), store_id, mode, delivery_address, status, subtotal / discount / delivery_fee / tax / total_cents, deal_id, idempotency_key, placed_at | CHECK that delivery orders have an address; UNIQUE(idempotency_key) stops duplicate orders; the server computes every money field |
| order_items | order_id, menu_item_id, name_snapshot, size, crust, qty, unit_price_cents, line_total_cents | CHECK qty between 1 and 20; snapshots keep old prices correct after the menu changes |
| order_item_toppings | order_item_id, topping_id, price_cents | Replaces the `toppings[]` string array |
| order_status_events | order_id, status, changed_at, changed_by | Keeps history instead of overwriting it; the tracker reads this table |
| reward_ledger | id, user_id, order_id, points, reason, created_at | UNIQUE(order_id, reason) so an order can't earn points twice; balance = SUM(points) |
| deal_redemptions | deal_id, order_id, user_id | UNIQUE(deal_id, order_id) |

## 3. Slide 7's questions applied to the pizza app

1. **Where is a confirmed order stored so the customer and kitchen see the same record?** In `orders` and `order_items` on the server. Before: `localStorage`, then nowhere.
2. **Why keep a cancelled order instead of deleting it?** For refunds, reward reversal and reporting, which `order_status_events` records. Before: there was no record to keep.
3. **What prevents duplicates?** UNIQUE(idempotency_key) on orders and UNIQUE(order_id, reason) on the reward ledger. Before: random 4-digit ids with no uniqueness check.
4. **How does the server know who is ordering?** From the session cookie, never the request body. Before: the `Order` type had no customer field.

## 4. Access rules (slide 29 format)

Returning a record does not mean returning every field.

| Operation | Guest | Customer | Staff |
|---|---|---|---|
| Read menu, deals, stores | Allowed | Allowed | Allowed |
| Place an order | Allowed (guest checkout) | For self | Only if explicitly permitted |
| Read an order | Order id plus a secret token | Own orders | Orders at their store |
| Change order status | Denied | Cancel own order while "received" | Advance orders at their store |
| Read or change reward points | Denied | Read own | Adjust through the ledger only |
| Set price, id or status in a request | Denied | Denied | Denied (the server computes these) |

## 5. Open issue

The Part 2 contract says "Anyone (guest checkout)," but the new schema in `lib/db.ts` declares `orders.user_id NOT NULL`, which requires sign-in. Either make `user_id` nullable to keep guest checkout, or change the contract's Access row to "signed-in customers only."

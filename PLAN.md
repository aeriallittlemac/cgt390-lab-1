# Pizza Website — Build Plan

A Next.js pizza-ordering website. This document is the reference plan; it will evolve as the
scaffold fills in.

## 1. Scope for this build

**Scaffolding only.** No database, no real auth backend, no payment processing.

- All content served from local JSON in `data/`.
- API routes return mocked responses (and proxy the free geocoder).
- "Sign In" is a stub button/modal. NextAuth deferred to a later phase.
- `Order` and `Reward` records are fixtures.
- Not included yet: real auth, DB, checkout/payment, live order tracking.

## 2. Confirmed decisions

| # | Decision | Effect |
|---|----------|--------|
| 1 | **No Google Maps.** Leaflet + React-Leaflet, OpenStreetMap tiles, Nominatim for geocoding / reverse-geocoding. All free, no API key. | `LocationMap` uses `react-leaflet`. Geocoding goes through an internal `/api/geocode` proxy that calls Nominatim, adds caching, sets a proper `User-Agent`, and debounces to respect the usage policy. |
| 2 | **Scaffolding only.** | See scope above. |
| 3 | **Delivery *and* pickup.** | `LocationContext` carries `mode: 'delivery' \| 'pickup'`. Drawer shows a toggle. Store list filters by `services` and shows delivery radius vs. pickup availability. |
| 4 | **"Order Now" forces a location.** | If `selectedLocation` is null, "Order Now" opens the location drawer instead of navigating. Once a location is confirmed it routes to `/order`. Menu and Deals stay browsable without a location. `/order` has a route guard: no location -> redirect home + open drawer. |

## 3. Tech stack

| Concern | Choice |
|---------|--------|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Drawer / dialog primitives | Hand-rolled `components/common/Drawer` (portal, focus trap, `Esc`, focus restore, scroll lock) — no extra dep for the scaffold |
| Global state | React Context; persisted slices via `useSyncExternalStore` over a small localStorage store (`lib/clientStore.ts`) so nothing calls `setState` in an effect |
| Maps | `react-leaflet` + `leaflet`, OpenStreetMap tiles |
| Geocoding | Nominatim via internal `/api/geocode` proxy |
| Persistence | `localStorage` for cart + selected location |
| Auth | Stubbed now; NextAuth later |
| Data | Local JSON in `data/` now; CMS/DB later |

## 4. Navigation

Header is a three-part grid: **left nav group | spacer | right nav group**.

- Left tabs: **Order Now**, **Menu**, **Deals**, **My Rewards**, **Tracker**
- Right tabs: **Choose Your Location**, **Sign In**, **Cart** (icon + item-count badge)

Key behavior: **"Order Now" and "Choose Your Location" are not routes.** Both call
`location.open()` and render the location drawer as an overlay on top of the current page
(no navigation). "Order Now" additionally routes to `/order` once a location is confirmed.

## 5. Routes

```
app/
  layout.tsx              Header + providers + LocationDrawer + CartDrawer mounted globally
  page.tsx                Landing: hero, featured deals, "Order Now" CTA
  menu/page.tsx           Menu categories + items (from data/menu.json)
  deals/page.tsx          Current promotions (from data/deals.json)
  rewards/page.tsx        My Rewards — "sign in to view" stub state
  tracker/page.tsx        Order-number input + status stepper (static)
  order/page.tsx          Guarded order-review stub (requires selected location)
  api/
    menu/route.ts         Returns data/menu.json
    deals/route.ts        Returns data/deals.json
    geocode/route.ts      Proxies Nominatim search + reverse
    orders/route.ts       Accepts POST, returns a fake order id
```

## 6. Component structure

```
components/
  header/    Header, NavTabs, LocationButton, AuthButton (stub), CartButton
  common/    Drawer (side: 'left' | 'right'), Button, Badge, Price
  location/  LocationDrawer, LocationSearchBox, LocationMap, StoreList,
             DeliveryPickupToggle, LocationConfirmBar
  cart/      CartDrawer, CartLineItem, CartSummary
  menu/      MenuCategoryNav, MenuItemCard, ItemCustomizerModal

context/     LocationContext, CartContext
data/        menu.json, deals.json, stores.json
lib/         geocode.ts (Nominatim client), distance.ts (haversine), storage.ts
```

## 7. Global state

- **LocationContext**: `{ isDrawerOpen, open(), close(), selectedLocation, setLocation(),
  mode: 'delivery' | 'pickup', setMode(), recentAddresses[] }`
- **CartContext**: `{ items[], addItem(), updateQty(), removeItem(), subtotal, isCartOpen,
  openCart(), closeCart() }`
- Auth: stub now; `useSession()` (NextAuth) later.

Header, LocationDrawer, and every "Order Now" button consume `LocationContext`, so the button
is simply `onClick={location.open}`.

## 8. Location drawer (core feature)

1. Trigger: `LocationButton` or any "Order Now" button -> `location.open()`.
2. Renders via portal: `position: fixed; inset-y-0; left-0`, width ~420px desktop /
   full-width mobile, `translate-x` transition, page-dimming backdrop. No navigation.
   Optionally reflect state as `?location=open` via shallow routing for back-button support.
3. Contents:
   - Search input -> `/api/geocode?q=` (Nominatim search), debounced.
   - "Use my current location" -> `navigator.geolocation` -> reverse geocode.
   - Leaflet map with a draggable center pin; dragging updates the candidate address.
   - Delivery / Pickup toggle.
   - Nearby store list from `data/stores.json` filtered by haversine distance, with hours and
     "open now" status, filtered by `services` for the chosen mode.
   - Confirm button -> `setLocation(...)`, close drawer, persist to `localStorage`; if opened
     from "Order Now", route to `/order`.
4. Accessibility: focus trap, `Esc` to close, restore focus to trigger, `aria-modal`.

## 9. Data models (MVP shapes)

```ts
Store    { id, name, address, lat, lng, hours, services: ('delivery'|'pickup')[], deliveryRadiusKm }
MenuItem { id, name, category, description, image, basePrice, sizes[], crusts[], toppings[] }
Deal     { id, title, description, code, image, expiresAt }
CartItem { id, menuItemId, name, size, crust, toppings[], qty, unitPrice }
Order    { id, storeId, mode, items[], status: 'received'|'making'|'baking'|'ready'|'out'|'delivered', placedAt }
Reward   { points, tier, history[] }
```

## 10. Build order

- [x] 1. Scaffold Next.js app (TS, Tailwind, App Router). Next.js 16 / React 19 / Tailwind v4.
- [x] 2. Header shell — responsive left/right tab groups, mobile hamburger, wired handlers.
- [x] 3. Shared `Drawer` component — left/right slide-over, backdrop, transitions, a11y.
- [x] 4. `LocationContext` + `LocationDrawer` — "Order Now" and "Choose Your Location" open it;
       delivery/pickup toggle, address search, distance-ranked store list, confirm.
- [ ] 5. Leaflet map + live Nominatim — swap `LocationMap` placeholder for `react-leaflet`
       with a draggable pin; the `/api/geocode` Nominatim proxy is already in place (returns
       `[]` when outbound network is unavailable).
- [x] 6. `CartContext` + `CartDrawer` — add/remove items, `localStorage` persistence.
- [x] 7. Menu page + `ItemCustomizer` — size/crust/add-ons -> add to cart.
- [x] 8. Deals page — promo cards. *("apply code" into cart still TODO.)*
- [x] 9. Tracker + Rewards stub pages.
- [x] 10. `/order` route guard + review stub -> `POST /api/orders` returns a fake order id
        feeding the tracker.
- [ ] 11. Polish — loading/empty/error states, SEO metadata, Lighthouse + a11y pass.

### Scaffold notes

- `npm run dev` / `build` / `lint` all green. Node is at `C:\Program Files\nodejs` (not on
  PATH by default in this shell).
- Persisted state (cart, location) uses `useSyncExternalStore` via `lib/clientStore.ts`.
- `/api/geocode` proxies Nominatim with a cache + `User-Agent`; set `NOMINATIM_CONTACT`
  in the environment before relying on it in production.
- `ItemCustomizer` / `LocationDrawer` bodies are remounted via `key` so each open starts
  from fresh form state without a `setState`-in-effect.

## 11. Deferred / later phases

- Real auth (NextAuth) and gated `/rewards`.
- Postgres + Prisma; replace JSON and mock API routes.
- Real checkout + payment.
- Live order tracking (polling or websockets).
- CMS for menu and deals.

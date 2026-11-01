# Browser-side input tests

The cart and the chosen location live in `localStorage` (`pizza.cart`, `pizza.location`),
read by `lib/storage.ts` → `lib/clientStore.ts`. `readJSON` checks only that the text is
valid JSON, then casts it (`as T`). Nothing checks the shape. Anyone can edit these values
in DevTools, so they are user input.

These can't run from Node. For each one: open the site, press F12, go to Console,
paste the snippet, then reload. Predictions come from reading the code and have
**not** been run yet. Record what actually happens.

Reset after each test:

```js
localStorage.removeItem("pizza.cart"); localStorage.removeItem("pizza.location"); location.reload();
```

## B1. Cart is valid JSON but the wrong shape

```js
localStorage.setItem("pizza.cart", "{}"); location.reload();
```

- **Prediction (baseline and current):** every page crashes. `CartProvider` sits in the root
  layout and runs `items.reduce(...)` (`context/CartContext.tsx`), but `{}` has no `.reduce`,
  so it throws `TypeError: items.reduce is not a function`.
- **Why:** `readJSON` only catches *broken* JSON. `{}` parses fine, so it isn't rejected.
- **Compare:** `localStorage.setItem("pizza.cart", "{bad")` is caught and falls back to an empty cart.

## B2. Tampered price in the cart

Add one item to the cart first, then:

```js
const c = JSON.parse(localStorage.getItem("pizza.cart")); c[0].unitPrice = 0.01;
localStorage.setItem("pizza.cart", JSON.stringify(c)); location.reload();
```

- **Prediction:** the cart and the order page show a $0.01 price.
  - Baseline: Place order succeeds, because the server never saw or checked prices.
  - Current: the server prices the order from the menu and returns the correct subtotal, but
    the order page still *displays* the client's $0.01 before you submit.

## B3. Tampered store or mode in the saved location

Pick a location first, then:

```js
const l = JSON.parse(localStorage.getItem("pizza.location")); l.storeId = "store-atlantis";
localStorage.setItem("pizza.location", JSON.stringify(l)); location.reload();
```

- **Prediction:**
  - Baseline: the order is accepted; the route guard in `app/order/page.tsx` only checks that
    *a* location exists.
  - Current: the server rejects it with 422 "Unknown store" and the page shows the error.

## B4. Delivery address outside the delivery radius

Choose delivery from Downtown, then move the address far away:

```js
const l = JSON.parse(localStorage.getItem("pizza.location")); l.lat = 0; l.lng = 0; l.label = "Gulf of Guinea";
localStorage.setItem("pizza.location", JSON.stringify(l)); location.reload();
```

- **Prediction (baseline and current):** the order is accepted. The radius rule is enforced
  only in `StoreList.tsx`, which disables out-of-range stores. The order request doesn't
  include the address, so the server can't check it.

## B5. Quantity with no upper limit

In the item customizer, press + until the quantity reaches 25, then add to cart.

- **Prediction:**
  - Baseline: accepted all the way through checkout.
  - Current: the cart accepts 25, but Place order fails with "qty must be a whole number from
    1 to 20". The UI and the server disagree, and the customer only finds out at checkout.

## B6. HTML in a cart field (safeguard check)

```js
localStorage.setItem("pizza.cart", JSON.stringify([{ id: "x", menuItemId: "drink-soda", name: "<img src=x onerror=alert(1)>",
  size: "20 oz", crust: "", toppings: [], qty: 1, unitPrice: 2.75 }])); location.reload();
```

- **Prediction:** the cart shows the text literally and no alert appears. React escapes
  text, so this is a safeguard that already works.

## B7. Same cart, two tabs (duplicate order)

Open `/order` in two tabs with the same cart and place the order in tab 1.

- **Prediction (baseline and current):** tab 2 still shows the cart and can place the same
  order again. `lib/clientStore.ts` notifies only listeners in its own tab (it never listens
  for the `storage` event), and the server has no duplicate check.

## B8. Tracker with a made-up order number

Enter `SS-0000` on `/tracker`.

- **Prediction:**
  - Baseline: shows a progress bar anyway. The status is computed from the *length* of the
    text (`app/tracker/page.tsx`), not looked up.
  - Current: "No order SS-0000 on your account."

# MCP Menu Tool: Session Answers (2026-11-09)

Answers from a Claude Code session about the `list_menu_items` MCP server in
`cgt390-lab-1`. Line numbers match the files as they were on 2026-11-09. Check
them again if any file has changed since.

Files read: `mcp/menu-server.mjs`, `mcp/inspector.config.json`,
`app/api/menu/route.ts`, `proxy.ts`, `next.config.ts`, `data/menu.json`,
`app/api/orders/route.ts`, `lib/dal.ts`, `lib/http.ts`, `package.json`.

---

## 1. Who does what: host, MCP server, access check

### 1.1 Discovering and calling the tool (AI host side)

None of the host code is in this repo. The host is a separate MCP client
program, such as the MCP Inspector or Claude. The repo only tells that client
how to start the server, in `mcp/inspector.config.json` lines 3–7:

```json
"menu-live": { "type": "stdio", "command": "node", "args": ["mcp/menu-server.mjs"],
               "env": { "MENU_API_BASE": "http://localhost:3000" } }
```

The client starts `node mcp/menu-server.mjs` as a child process and talks to it
over stdin/stdout. It asks the server what tools it has and calls
`list_menu_items` by name. The server's side of that connection is set up at
`mcp/menu-server.mjs` line 100: `await server.connect(new StdioServerTransport());`.
The host learns about the tool from what's registered at lines 21–40: the name,
the description, an empty `inputSchema: {}`, and `readOnlyHint: true`.

### 1.2 Turning the tool call into an HTTP request (MCP server)

This is `listMenuItems()` in `mcp/menu-server.mjs` lines 42–77, which
`registerTool` names as the handler.

1. **Building the URL** (lines 13–14): it's `MENU_API_BASE`, or
   `http://localhost:3000` if that's not set, plus `/api/menu`.
2. **Sending the request** (lines 45–48): a plain `GET`. The only header is
   `Accept: application/json`, with a 5-second timeout. **It sends no auth
   header, API key, token or cookie.**
3. **Handling failures** (lines 49–66): if the server can't be reached, returns
   a non-OK status, sends something that isn't JSON, or sends JSON that isn't
   an array, `toolError()` returns `isError: true` with a message.
4. **Reshaping the data** (lines 68–76, and `toToolItem` at lines 80–93): it
   works out each size's price as `basePrice + priceDelta`, drops `image`, and
   returns the result as JSON text.

### 1.3 Checking access to the data

**Nothing checks access on this path.** The whole route,
`app/api/menu/route.ts`, is:

```ts
import menu from "@/data/menu.json";
export async function GET() {
  return Response.json(menu);
}
```

It doesn't take a `request` parameter at all, so it never reads headers,
cookies or the query string. It returns the static file `data/menu.json` as is.

### 1.4 Does `/api/menu` require auth anywhere?

**No.**

- **Route:** has no auth check (quoted above).
- **Proxy:** the only proxy (Next.js 16's name for middleware) is `proxy.ts`.
  Its matcher at line 19 leaves out `/api/menu`:
  ```ts
  matcher: ["/account/:path*", "/order/:path*", "/tracker/:path*", "/rewards/:path*"],
  ```
  So the proxy never runs for `/api/menu`. On the pages it does cover, it only
  checks that a cookie named `session` exists (line 10). Its own comment says
  the real check happens in `lib/dal.ts`, which the menu route doesn't import.
- **`next.config.ts`:** has no headers, rewrites, redirects or proxy settings.

### 1.5 Where credentials are supplied

On this path, credentials are supplied nowhere. Neither the host config nor
the MCP server nor the route supplies or asks for any. The only setting the
host passes is `MENU_API_BASE`, which is a URL, not a secret.

What the code shows about why the endpoint can be public: it only answers
`GET`, and it returns a fixed file. That file has 6 items, and each item has
only these fields: `id, name, category, description, basePrice, sizes, crusts,
toppings, image`. It has no user, order or account data and doesn't touch the
database. The tool takes no inputs, so the AI can't change what gets requested.

---

## 2. Running the API-failure test

### What to change

Nothing. `mcp/inspector.config.json` already defines two servers that run the
same `menu-server.mjs` with different `MENU_API_BASE` values:

- **`menu-live`**: `http://localhost:3000` (normal)
- **`menu-dead`**: `http://127.0.0.1:9` (nothing is listening on port 9)

Override `MENU_API_BASE`, not `MENU_URL`. `MENU_URL` is built from
`MENU_API_BASE` (lines 13–14) and isn't read from the environment.

### Running it

1. If Inspector is running, stop it with Ctrl+C. The server only reads
   `MENU_API_BASE` when it starts, so it needs a restart.
2. From the project root, run:
   ```powershell
   npm run inspect:menu:dead
   ```
   This is the same as
   `npx @modelcontextprotocol/inspector --config mcp/inspector.config.json --server menu-dead`.
   The app doesn't need to be running.
3. In Inspector, click **Connect**, open **Tools**, click **List Tools**,
   choose `list_menu_items`, then click **Run Tool**.

### What you should see

- **List Tools still works** and shows `list_menu_items`, because listing
  tools never calls the API.
- **Run Tool returns an error result** (`isError: true`):
  ```
  Couldn't reach http://127.0.0.1:9/api/menu (fetch failed). Is the app running?
  ```
  This comes from the `catch` at lines 49–52. A test `fetch` to that address
  on this machine threw `TypeError: fetch failed`.
- The connection stays up. The tool reports a failure, but the server doesn't
  crash.

This test fails in a different way from the trace in
`workshop/mcp-menu-tool-traces.md` line 32. That earlier error was
`localhost:3000` with the app stopped; this one is a bad configured URL.

### Reverting

Nothing was edited, so there's nothing to undo. Start the app (`npm run dev`)
and run `npm run inspect:menu` to use `menu-live`. `list_menu_items` should
return `{ source, count: 6, items: [...] }`. If you ever set
`$env:MENU_API_BASE` by hand in PowerShell, clear it with
`Remove-Item Env:MENU_API_BASE`.

---

## 3. Pepperoni Classic: tool result vs. assistant reply

**Tool result** (`data/menu.json` after `toToolItem`):

```json
{
  "id": "pizza-pepperoni",
  "name": "Pepperoni Classic",
  "category": "Pizzas",
  "description": "Double pepperoni, mozzarella, oregano, tomato sauce.",
  "sizes": [
    { "label": "10\"", "price": 15 },
    { "label": "14\"", "price": 19 },
    { "label": "18\"", "price": 23 }
  ],
  "crusts": ["Classic", "Thin", "Deep Dish", "Gluten-Free"],
  "toppings": ["Extra pepperoni", "Jalapeno", "Onion", "Hot honey"]
}
```

**Assistant reply** to "How much is a large pepperoni with jalapeño?":

> The large (18") Pepperoni Classic is $23 before tax. Jalapeño is listed as an
> available topping, but the menu doesn't include topping prices, so I can't
> give you an exact total with jalapeño added — the $23 is just for the base
> pizza.

**Comparison:**

- **Matches exactly:** $23 is the 18" price (15 + 8). Jalapeno is in the
  toppings list. The tool result has no topping prices.
- **Not in the returned data:**
  - "Large" is the assistant's own mapping of the user's word onto `18"`. The
    data has only `10"`, `14"` and `18"`.
  - "Before tax" comes from the tool's *description* (line 29), not from the
    JSON. The description says "before tax and deals," and the reply leaves out
    deals.

---

## 4. Report answers (in my voice)

**1. What does the MCP server add between the AI host and the existing API?**
The MCP server adds a named, described tool that the AI host can find and call
over stdio. Without it, the host would have to know the raw API URL. In
`mcp/menu-server.mjs` (lines 21–40) I register `list_menu_items`. Its
description tells the model when to use it and what it can't do, for example
that toppings have no prices. It also has an empty input schema and the
annotations `readOnlyHint: true, openWorldHint: false`. The handler,
`listMenuItems()` (lines 42–77), turns each call into a plain `GET /api/menu`
with a 5-second timeout. It works out each size's final price
(`basePrice + priceDelta`, line 88) and drops the image path. If the request
fails, it returns a clear `isError` result instead of crashing. The API itself
is unchanged: `app/api/menu/route.ts` still just returns `data/menu.json`.

**2. Where are credentials supplied, and where is the user's identity or
permission checked?**
For this tool, nowhere. The host config (`mcp/inspector.config.json`, lines
3–7) passes only `MENU_API_BASE`, which is a URL, not a secret. The handler's
fetch (`menu-server.mjs` lines 45–48) sends only an `Accept: application/json`
header. The route (`app/api/menu/route.ts`, lines 4–6) doesn't even take a
request argument, so it never reads headers or cookies. My `proxy.ts` only
matches `/account`, `/order`, `/tracker` and `/rewards` (line 19), so it never
runs for `/api/menu`. That's deliberate, because the endpoint only returns
public menu data. In my app, identity is checked in `lib/dal.ts`, where
`getCurrentUser()` (line 10) reads the session, and only on routes that need
it, like `/api/orders`.

**3. Why is this tool useful for my prototype? What can it access, and what
should stay unavailable?**
The tool lets an assistant answer customer questions like "what sizes does the
pepperoni come in?" or "how much is an 18-inch?" from the real menu instead of
guessing. It can only read the six items in `data/menu.json`. Each item has its
id, name, category, description, sizes and prices, crusts and topping names.
The tool takes no inputs, so the model can't change what gets requested.
Everything tied to a user should stay out of reach: orders, accounts, sessions
and the SQLite database. Anything that writes data should stay out too.
Because the menu endpoint is public, read-only and has nothing sensitive in it,
it's safe to expose without credentials.

**4. If I added a tool that changes data, what would it do, what should the
user see before approving, and why wouldn't approval override API
permissions?**
A natural next tool would be `place_order`. It would wrap `POST /api/orders`,
which validates and prices the order, then saves it under the signed-in user
(`app/api/orders/route.ts`, lines 9–22). I'd mark it `readOnlyHint: false`.
Before approving, the user should see exactly what will be submitted: each
item, size, crust and toppings, the quantity, and the server's calculated
total. They should also see that the order is placed under their account and
can't be undone from the chat. Approving in the host only lets the tool *send*
the request. The API still decides whether to accept it. The route calls
`getCurrentUser()` and returns 401 "Sign in to place an order" if there's no
valid session (lines 12–13). It also rejects cross-site requests (line 10) and
validates the body (lines 18–19). Clicking "approve" in the AI host doesn't
create a session or skip any of those checks. Permission stays with the
server, not the chat window.

**5. Did the assistant accurately describe the tool result in my Part 4
test?**
Yes. Every number and claim in the reply traces back to the tool result. The
$23 is exactly the 18" price the tool returned for Pepperoni Classic:
`basePrice` 15 + `priceDelta` 8, which the handler computes in
`mcp/menu-server.mjs` line 88. "Jalapeño" really does appear in the item's
`toppings` list. The assistant also correctly said it couldn't give a total
with jalapeño, because the data lists toppings by name only. That matches the
tool description's warning not to quote a price for an order with toppings
(`menu-server.mjs` lines 29–30). Two parts of the wording aren't in the
returned data itself. First, "large" is the assistant's own mapping of my word
onto the 18" size, since the menu has no size called "large." Second, "before
tax" comes from the tool's description (line 29), not from the JSON. The
description actually says "before tax and deals," and the assistant left out
the deals part. Neither changes the answer, but they show the model mixing the
tool's data with its own reading and the tool's description.

---

## 5. Repo and files for the AI-assistance statement

**Remote:** `https://github.com/aeriallittlemac/cgt390-lab-1`, branch `main`.
As of this session, none of the MCP work is committed or pushed.

### New files (untracked)

| File | What it is | Created / last changed |
|---|---|---|
| `mcp/menu-server.mjs` | The MCP server: `registerTool("list_menu_items")`, the `listMenuItems()` handler, `toToolItem`, `toolError` | created Nov 3, 12:01 PM, last changed 1:17 PM |
| `mcp/inspector.config.json` | The Inspector config for `menu-live` and `menu-dead` | Nov 3, 12:31 PM |
| `workshop/mcp-menu-tool-traces.md` | Written tool-call traces | Nov 3, 12:19 PM |

### Changed files (uncommitted)

- `package.json`: the MCP-related changes are:
  - the scripts `inspect:menu` and `inspect:menu:dead`
  - the devDependencies `@modelcontextprotocol/sdk ^1.32.2` and
    `@modelcontextprotocol/inspector ^2.13.0`
  - the devDependency `zod ^4.6.7`. My code never imports zod, but the SDK
    lists it as a peer dependency (`"zod": "^3.25 || ^4.0"`).
- `package-lock.json`: regenerated by npm, including the
  `@modelcontextprotocol/*` packages.

### Not part of the MCP work, but in the same uncommitted changes

- `@libsql/client`, and the edits to `app/api/orders/*`, `lib/db.ts`,
  `lib/session.ts`, `lib/users.ts`, `lib/orderStore.ts`, `app/account`,
  `app/tracker` and `scripts/make-staff.mjs`. These belong to the accounts and
  orders work.
- `.claude/settings.json` and `.claude/settings.local.json`: Claude Code
  settings from before the MCP files existed.

### Files the MCP server uses but that weren't changed

`app/api/menu/route.ts`, `data/menu.json`, `proxy.ts`.

### What happened in this session

The AI assistant read files and ran test commands: a `fetch` to `127.0.0.1:9`,
plus git and file checks. It didn't create or change any code or config. The
only file it wrote is this one. The timestamps above show when files were
created and saved. They don't show who wrote which part.

// MCP server with one read-only tool, list_menu_items, that wraps GET /api/menu.
//
// Usage: start the app first (npm run dev), then point an MCP client at
//   node mcp/menu-server.mjs
// It talks to the client over stdin/stdout, so it must never console.log;
// diagnostics go to stderr with console.error.
//
// Set MENU_API_BASE to use a different server, e.g. the deployed site.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const BASE = (process.env.MENU_API_BASE ?? "http://localhost:3000").replace(/\/$/, "");
const MENU_URL = `${BASE}/api/menu`;
const TIMEOUT_MS = 5000;

const server = new McpServer({ name: "slice-society-menu", version: "0.1.0" });

// ---------- 1. Name and description ----------

server.registerTool(
  "list_menu_items",
  {
    title: "List menu items",
    description: [
      "Lists every item on the Slice Society menu (pizzas, sides, drinks) with its sizes, prices, crusts and toppings.",
      "Use it when the user asks what's on the menu, what an item costs, or which sizes, crusts or toppings an item offers.",
      "Returns the whole menu at once; it takes no inputs and can't filter, so filter the results yourself.",
      "Limitations: prices are in US dollars per item before tax and deals. Toppings are listed by name only:",
      "the menu doesn't include topping prices, so don't quote a price for an order with toppings.",
      "It doesn't show deals, store hours, or whether an item is in stock.",
    ].join(" "),
    // ---------- 2. Input schema ----------
    // GET /api/menu reads no query parameters, so the tool takes no inputs.
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  // ---------- 3. Handler ----------
  listMenuItems,
);

async function listMenuItems() {
  let res;
  try {
    res = await fetch(MENU_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const why = err.name === "TimeoutError" ? `no answer within ${TIMEOUT_MS / 1000} s` : err.message;
    return toolError(`Couldn't reach ${MENU_URL} (${why}). Is the app running?`);
  }

  if (!res.ok) {
    return toolError(`GET ${MENU_URL} returned ${res.status} ${res.statusText}. The menu is unavailable right now.`);
  }

  let menu;
  try {
    menu = await res.json();
  } catch {
    return toolError(`GET ${MENU_URL} returned a response that isn't JSON.`);
  }
  if (!Array.isArray(menu)) {
    return toolError(`GET ${MENU_URL} returned JSON, but not the expected list of menu items.`);
  }

  const items = menu.map(toToolItem);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ source: MENU_URL, count: items.length, items }, null, 2),
      },
    ],
  };
}

/** Reshapes one API menu item for the assistant: works out each size's price and drops the image path. */
function toToolItem(item) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    description: item.description,
    sizes: item.sizes.map((s) => ({
      label: s.label,
      price: Math.round((item.basePrice + s.priceDelta) * 100) / 100,
    })),
    crusts: item.crusts,
    toppings: item.toppings,
  };
}

/** A tool result the assistant sees as a failure, with a message it can relay to the user. */
function toolError(message) {
  return { isError: true, content: [{ type: "text", text: message }] };
}

await server.connect(new StdioServerTransport());
console.error(`slice-society-menu MCP server ready (menu at ${MENU_URL})`);

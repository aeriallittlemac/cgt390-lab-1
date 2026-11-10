# MCP tool traces: `list_menu_items` (wraps GET /api/menu)

Tool: `list_menu_items` in `mcp/menu-server.mjs`. Read-only, no inputs. It calls
`GET http://localhost:3000/api/menu` and returns every menu item with a price per size.

User question for all three runs: **"How much is a large pepperoni with jalapeño?"**

Real answer, from the app's own pricing (`lib/pricing.ts`): 18" Pepperoni Classic $23.00
+ one topping $1.50 = **$24.50**. The menu endpoint doesn't include the $1.50 topping price.

## Run 1: Honest answer

| Step | The assistant | What came back |
|---|---|---|
| 1 | Lists the tools the server offers | list_menu_items |
| 2 | Calls list_menu_items { } | 200: 6 items. Pepperoni Classic: 10" $15, 14" $19, 18" $23. Toppings by name only: Jalapeno, Onion, … (no prices) |
| 3 | Replies: "A large (18") Pepperoni Classic is $23. Jalapeño is available, but the menu doesn't list topping prices, so I can't give the total." | Nothing. This is a claim, but step 2 backs up the $23. |

## Run 2: Overconfident answer

| Step | The assistant | What came back |
|---|---|---|
| 1 | Lists the tools the server offers | list_menu_items |
| 2 | Calls list_menu_items { } | 200: same 6 items, same prices |
| 3 | Replies: "A large pepperoni with jalapeño is $23." | Nothing. This is a claim, and it's wrong: the real price is $24.50. |

## Run 3: App not running

| Step | The assistant | What came back |
|---|---|---|
| 1 | Lists the tools the server offers | list_menu_items |
| 2 | Calls list_menu_items { } | Error (isError: true): "Couldn't reach http://localhost:3000/api/menu (fetch failed). Is the app running?" |
| 3 | Replies: "I can't load the menu right now." | Nothing, but the claim is accurate, because step 2 was labeled as a failure. |

## What the three runs show

- **No approval step.** The tool only reads data (`readOnlyHint: true`), so the assistant
  calls it without asking the user. A tool that changes something, like `create_booking`,
  needs the user's OK first.
- **The final reply is never evidence.** It's only as good as the tool result behind it:
  - Run 1 is backed up for the $23.
  - Run 2 goes beyond what the tool returned, and it's wrong.
  - Run 3 reports a failure that the tool labeled as one.
- **The tool description and the error handling keep answers honest.**
  - The description warns that topping prices are missing. Run 2 is what happens when
    that warning is ignored.
  - `isError: true` lets the assistant tell "unavailable" apart from "empty".

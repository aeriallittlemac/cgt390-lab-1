import "server-only";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client, type InArgs, type InStatement } from "@libsql/client";

// SQLite via libSQL. This is the source of truth for accounts, sessions and
// orders. Menu and store data stay in data/*.json.
//
// Deployed (Vercel): set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to a hosted
// Turso database. Serverless functions don't share a filesystem, so a local
// file would give each function its own separate, temporary copy.
// Locally: with no TURSO_DATABASE_URL, a file at .data/slice-society.db
// (or DATABASE_PATH) is used instead.

const LOCAL_PATH = process.env.DATABASE_PATH ?? join(process.cwd(), ".data", "slice-society.db");

const SCHEMA = `
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
`;

function open(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  if (process.env.VERCEL) {
    throw new Error("TURSO_DATABASE_URL is not set. Add it (and TURSO_AUTH_TOKEN) in the Vercel project settings.");
  }
  mkdirSync(join(LOCAL_PATH, ".."), { recursive: true });
  return createClient({ url: pathToFileURL(LOCAL_PATH).href });
}

async function init(client: Client): Promise<void> {
  if (!process.env.TURSO_DATABASE_URL) {
    await client.executeMultiple("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  }
  await client.executeMultiple(SCHEMA);
}

// Reuse one client (and one schema check) per server instance and across dev hot reloads.
const globalForDb = globalThis as unknown as { sliceSocietyDb?: { client: Client; ready: Promise<void> } };

function connection() {
  if (!globalForDb.sliceSocietyDb) {
    const client = open();
    const ready = init(client);
    // Retry the schema check on the next request instead of caching a failure.
    ready.catch(() => (globalForDb.sliceSocietyDb = undefined));
    globalForDb.sliceSocietyDb = { client, ready };
  }
  return globalForDb.sliceSocietyDb;
}

async function client(): Promise<Client> {
  const { client, ready } = connection();
  await ready;
  return client;
}

/** All rows for a query. */
export async function all<T>(sql: string, args: InArgs = []): Promise<T[]> {
  const result = await (await client()).execute({ sql, args });
  return result.rows as unknown as T[];
}

/** The first row for a query, or undefined. */
export async function get<T>(sql: string, args: InArgs = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}

/** Runs a write and returns the number of rows it changed. */
export async function run(sql: string, args: InArgs = []): Promise<number> {
  return (await (await client()).execute({ sql, args })).rowsAffected;
}

/** Runs statements as one transaction: all of them apply, or none do. */
export async function batch(statements: InStatement[]): Promise<void> {
  await (await client()).batch(statements, "write");
}

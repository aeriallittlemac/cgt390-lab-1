import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

// SQLite (built into Node 22.5+) stored in a local file. This is the source of
// truth for accounts, sessions and orders. Menu and store data stay in data/*.json.
//
// Limitation: serverless hosts (e.g. Vercel) have a read-only, per-instance
// filesystem, so this file store only persists on a long-running Node server or
// locally. Swap for a hosted database before relying on it in production.

const DB_PATH = process.env.DATABASE_PATH ?? join(process.cwd(), ".data", "slice-society.db");

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

function open(): DatabaseSync {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  return db;
}

// Reuse one connection across dev hot reloads.
const globalForDb = globalThis as unknown as { sliceSocietyDb?: DatabaseSync };
export const db = globalForDb.sliceSocietyDb ?? (globalForDb.sliceSocietyDb = open());

/** Runs fn inside a transaction, rolling back if it throws. */
export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

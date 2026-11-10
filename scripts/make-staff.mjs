// Grants (or removes) the staff role for an existing account.
// Staff can't be created through the sign-up API; an administrator with
// access to the database runs this instead.
//
// Usage:
//   node scripts/make-staff.mjs someone@example.com          # make staff
//   node scripts/make-staff.mjs someone@example.com --revoke # back to customer
//
// Uses the local .data database unless TURSO_DATABASE_URL (and
// TURSO_AUTH_TOKEN) are set, in which case it updates the hosted one.

import { join } from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error("Usage: node scripts/make-staff.mjs <email> [--revoke]");
  process.exit(1);
}

let url = process.env.TURSO_DATABASE_URL;
if (!url) {
  const dbPath = process.env.DATABASE_PATH ?? join(process.cwd(), ".data", "slice-society.db");
  if (!existsSync(dbPath)) {
    console.error(`No database at ${dbPath}. Start the app and create the account first.`);
    process.exit(1);
  }
  url = pathToFileURL(dbPath).href;
}

const role = flag === "--revoke" ? "customer" : "staff";
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const { rowsAffected } = await db.execute({
  sql: "UPDATE users SET role = ? WHERE email = ?",
  args: [role, email.trim().toLowerCase()],
});

if (!rowsAffected) {
  console.error(`No account with email ${email}`);
  process.exit(1);
}
console.log(`${email} is now ${role}`);

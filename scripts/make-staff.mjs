// Grants (or removes) the staff role for an existing account.
// Staff can't be created through the sign-up API; an administrator with
// access to the server runs this instead.
//
// Usage:
//   node scripts/make-staff.mjs someone@example.com          # make staff
//   node scripts/make-staff.mjs someone@example.com --revoke # back to customer

import { join } from "node:path";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error("Usage: node scripts/make-staff.mjs <email> [--revoke]");
  process.exit(1);
}

const dbPath = process.env.DATABASE_PATH ?? join(process.cwd(), ".data", "slice-society.db");
if (!existsSync(dbPath)) {
  console.error(`No database at ${dbPath}. Start the app and create the account first.`);
  process.exit(1);
}

const role = flag === "--revoke" ? "customer" : "staff";
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA busy_timeout = 5000;");
const { changes } = db
  .prepare("UPDATE users SET role = ? WHERE email = ?")
  .run(role, email.trim().toLowerCase());

if (!changes) {
  console.error(`No account with email ${email}`);
  process.exit(1);
}
console.log(`${email} is now ${role}`);

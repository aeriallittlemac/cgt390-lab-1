import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { toPublicUser } from "./users";
import type { PublicUser, UserRole } from "./types";

// Database sessions: the cookie holds a random token, and the sessions table
// holds its SHA-256 hash. Signing out deletes the row, so a copied cookie stops
// working immediately (a signed-JWT cookie would stay valid until it expired).

export const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Starts a session for the user and sets the cookie. Call only from Route Handlers or Server Actions. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(
    hashToken(token),
    userId,
    expiresAt,
  );

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // not readable from page JavaScript
    secure: process.env.NODE_ENV === "production", // HTTPS only once deployed
    sameSite: "lax", // not sent on cross-site POSTs
    path: "/",
    expires: new Date(expiresAt),
  });
}

/** Looks up the user for the current request's session cookie, or null. */
export async function getSessionUser(): Promise<PublicUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT s.id AS session_id, s.expires_at, u.id, u.name, u.email, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
    )
    .get(hashToken(token)) as
    | { session_id: string; expires_at: number; id: string; name: string; email: string; role: UserRole }
    | undefined;

  if (!row) return null;
  if (row.expires_at <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(row.session_id);
    return null;
  }
  return toPublicUser(row);
}

/** Ends the current session server-side and clears the cookie. */
export async function deleteSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) db.prepare("DELETE FROM sessions WHERE id = ?").run(hashToken(token));
  store.delete(SESSION_COOKIE);
}

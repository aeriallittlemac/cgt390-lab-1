import "server-only";
import { randomUUID } from "node:crypto";
import { get, run } from "./db";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password";
import type { PublicUser, UserRole } from "./types";

export const PASSWORD_MIN = 8;
// Caps the work a single request can force on the password hasher.
export const PASSWORD_MAX = 128;

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password_hash: string;
}

export function toPublicUser(row: Pick<UserRow, "id" | "name" | "email" | "role">): PublicUser {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

type Fields = Record<string, unknown>;
export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

function isPlainObject(v: unknown): v is Fields {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function unexpected(body: Fields, allowed: string[]): string | null {
  const extra = Object.keys(body).filter((k) => !allowed.includes(k));
  return extra.length ? `Unexpected field(s): ${extra.join(", ")}` : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignup(
  body: unknown,
): Validation<{ name: string; email: string; password: string }> {
  if (!isPlainObject(body)) return { ok: false, error: "Body must be a JSON object" };
  const extra = unexpected(body, ["name", "email", "password"]);
  if (extra) return { ok: false, error: extra };

  const { name, email, password } = body;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 50) {
    return { ok: false, error: "name is required (1–50 characters)" };
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim()) || email.length > 254) {
    return { ok: false, error: "email must be a valid email address" };
  }
  if (
    typeof password !== "string" ||
    password.length < PASSWORD_MIN ||
    password.length > PASSWORD_MAX
  ) {
    return {
      ok: false,
      error: `password must be ${PASSWORD_MIN}–${PASSWORD_MAX} characters`,
    };
  }
  return {
    ok: true,
    value: { name: name.trim(), email: email.trim().toLowerCase(), password },
  };
}

export function validateLogin(body: unknown): Validation<{ email: string; password: string }> {
  if (!isPlainObject(body)) return { ok: false, error: "Body must be a JSON object" };
  const extra = unexpected(body, ["email", "password"]);
  if (extra) return { ok: false, error: extra };

  const { email, password } = body;
  if (typeof email !== "string" || !email.trim()) return { ok: false, error: "email is required" };
  if (typeof password !== "string" || !password || password.length > PASSWORD_MAX) {
    return { ok: false, error: "password is required" };
  }
  return { ok: true, value: { email: email.trim().toLowerCase(), password } };
}

/** Creates a customer account. Returns null if the email is already registered. */
export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<PublicUser | null> {
  const passwordHash = await hashPassword(input.password);
  const user = { id: randomUUID(), name: input.name, email: input.email, role: "customer" as const };
  try {
    await run(
      `INSERT INTO users (id, email, name, password_hash, role, created_at)
       VALUES (?, ?, ?, ?, 'customer', ?)`,
      [user.id, user.email, user.name, passwordHash, new Date().toISOString()],
    );
  } catch (err) {
    // The UNIQUE constraint on email is the real duplicate check, so two
    // simultaneous sign-ups with the same email can't both succeed.
    if (err instanceof Error && /UNIQUE constraint failed: users\.email/.test(err.message)) {
      return null;
    }
    throw err;
  }
  return user;
}

/** Returns the user only if the email exists and the password matches. */
export async function authenticate(email: string, password: string): Promise<PublicUser | null> {
  const row = await get<UserRow>(
    "SELECT id, name, email, role, password_hash FROM users WHERE email = ?",
    [email],
  );
  if (!row) {
    await burnPasswordCheck(password);
    return null;
  }
  return (await verifyPassword(password, row.password_hash)) ? toPublicUser(row) : null;
}

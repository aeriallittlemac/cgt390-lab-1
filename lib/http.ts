import "server-only";
import type { NextRequest } from "next/server";

// Small helpers shared by the API Route Handlers.

export function errorResponse(status: number, error: string, headers?: HeadersInit): Response {
  return Response.json({ error }, { status, headers });
}

/** Parses the JSON body, or returns a 400 response to send back. */
export async function readJson(
  request: NextRequest,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false, response: errorResponse(400, "Request body must be valid JSON") };
  }
}

/**
 * CSRF defense for state-changing requests that rely on the session cookie.
 * Browsers always send Origin on cross-site POST/PATCH; reject any that don't
 * match this site. Requests with no Origin (curl, Postman, server-to-server)
 * carry no browser cookies unless the caller added them deliberately.
 */
export function isCrossSite(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true;
  }
}

export const crossSiteResponse = () => errorResponse(403, "Cross-site request rejected");

// In-memory fixed-window limiter for login attempts. Per server instance, so
// it is a speed bump rather than a guarantee on multi-instance hosting.
const attempts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  entry.count++;
  return {
    allowed: entry.count <= limit,
    retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
  };
}

export function resetRateLimit(key: string): void {
  attempts.delete(key);
}

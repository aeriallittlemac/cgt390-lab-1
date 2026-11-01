import type { NextRequest } from "next/server";
import { createSession, deleteSession } from "@/lib/session";
import { authenticate, validateLogin } from "@/lib/users";
import {
  crossSiteResponse,
  errorResponse,
  isCrossSite,
  rateLimit,
  readJson,
  resetRateLimit,
} from "@/lib/http";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (isCrossSite(request)) return crossSiteResponse();

  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;

  const input = validateLogin(parsed.body);
  if (!input.ok) return errorResponse(400, input.error);

  const { email, password } = input.value;
  const limitKey = `login:${email}`;
  const limit = rateLimit(limitKey, MAX_ATTEMPTS, WINDOW_MS);
  if (!limit.allowed) {
    return errorResponse(429, "Too many sign-in attempts. Try again later.", {
      "Retry-After": String(limit.retryAfterSec),
    });
  }

  const user = await authenticate(email, password);
  // One message for both cases, so the response doesn't reveal which emails have accounts.
  if (!user) return errorResponse(401, "Incorrect email or password");

  resetRateLimit(limitKey);
  // Replace any existing session rather than reusing its token.
  await deleteSession();
  await createSession(user.id);
  return Response.json({ user });
}

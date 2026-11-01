import type { NextRequest } from "next/server";
import { createSession } from "@/lib/session";
import { createUser, validateSignup } from "@/lib/users";
import { crossSiteResponse, errorResponse, isCrossSite, readJson } from "@/lib/http";

// Creates a customer account and signs it in. Staff accounts can't be created
// here; see scripts/make-staff.mjs.
export async function POST(request: NextRequest) {
  if (isCrossSite(request)) return crossSiteResponse();

  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;

  const input = validateSignup(parsed.body);
  if (!input.ok) return errorResponse(400, input.error);

  const user = await createUser(input.value);
  if (!user) return errorResponse(409, "An account with that email already exists");

  await createSession(user.id);
  return Response.json({ user }, { status: 201 });
}

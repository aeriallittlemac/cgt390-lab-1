import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { validateOrder } from "@/lib/orders";
import { listOrdersFor, saveOrder } from "@/lib/orderStore";
import { crossSiteResponse, errorResponse, isCrossSite, readJson } from "@/lib/http";

// Places an order for the signed-in user. The server validates and prices it,
// then saves it with the user as its owner.
export async function POST(request: NextRequest) {
  if (isCrossSite(request)) return crossSiteResponse();

  const user = await getCurrentUser();
  if (!user) return errorResponse(401, "Sign in to place an order");

  // Optional: the checkout page sends one key per checkout attempt, so a
  // double-click or retry can't place the same order twice.
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey !== null && !IDEMPOTENCY_KEY.test(idempotencyKey)) {
    return errorResponse(400, "Idempotency-Key must be 8–100 letters, digits, - or _");
  }

  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;

  const result = validateOrder(parsed.body);
  if (!result.ok) return errorResponse(result.status, result.error);

  const saved = await saveOrder(user.id, result.order, idempotencyKey ?? undefined);
  if (!saved.ok) return errorResponse(saved.status, saved.error);
  // A repeat answers with the order the first request created: 200, not a new 201.
  return Response.json(saved.order, saved.replayed
    ? { status: 200, headers: { "Idempotent-Replayed": "true" } }
    : { status: 201 });
}

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/;

// Customers get their own orders; staff get every order.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return errorResponse(401, "Sign in to view orders");
  return Response.json({ orders: await listOrdersFor(user) });
}

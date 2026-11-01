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

  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;

  const result = validateOrder(parsed.body);
  if (!result.ok) return errorResponse(result.status, result.error);

  return Response.json(saveOrder(user.id, result.order), { status: 201 });
}

// Customers get their own orders; staff get every order.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return errorResponse(401, "Sign in to view orders");
  return Response.json({ orders: listOrdersFor(user) });
}

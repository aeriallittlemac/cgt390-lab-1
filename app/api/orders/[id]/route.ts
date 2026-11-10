import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { advanceStatus, getOrderFor, ORDER_STATUSES } from "@/lib/orderStore";
import { crossSiteResponse, errorResponse, isCrossSite, readJson } from "@/lib/http";
import type { OrderStatus } from "@/lib/types";

// Owner or staff only. Anyone else gets 404, the same as a missing order.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/orders/[id]">) {
  const user = await getCurrentUser();
  if (!user) return errorResponse(401, "Sign in to view this order");

  const order = await getOrderFor(user, (await ctx.params).id);
  if (!order) return errorResponse(404, "Order not found");
  return Response.json(order);
}

// Staff only: move an order to its next status.
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/orders/[id]">) {
  if (isCrossSite(request)) return crossSiteResponse();

  const user = await getCurrentUser();
  if (!user) return errorResponse(401, "Sign in to update orders");
  if (user.role !== "staff") return errorResponse(403, "Only staff can update order status");

  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;

  const body = parsed.body;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return errorResponse(400, "Body must be a JSON object");
  }
  const extra = Object.keys(body).filter((k) => k !== "status");
  if (extra.length) return errorResponse(400, `Unexpected field(s): ${extra.join(", ")}`);

  const { status } = body as { status?: unknown };
  if (!ORDER_STATUSES.includes(status as OrderStatus)) {
    return errorResponse(400, `status must be one of: ${ORDER_STATUSES.join(", ")}`);
  }

  const result = await advanceStatus((await ctx.params).id, status as OrderStatus);
  if (!result.ok) return errorResponse(result.status, result.error);
  return Response.json(result.order);
}

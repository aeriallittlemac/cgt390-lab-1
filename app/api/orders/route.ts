import type { NextRequest } from "next/server";
import { validateOrder } from "@/lib/orders";

// Mock order creation. Validates and prices the order on the server, then
// returns a fake order id the tracker can display.
// No persistence — a real implementation writes to a DB in a later phase.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const result = validateOrder(body);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  const id = `SS-${Math.floor(1000 + Math.random() * 9000)}`;

  return Response.json(
    {
      id,
      status: "received",
      placedAt: new Date().toISOString(),
      ...result.order,
    },
    { status: 201 },
  );
}

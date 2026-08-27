import type { NextRequest } from "next/server";

// Mock order creation. Returns a fake order id the tracker can display.
// No persistence — a real implementation writes to a DB in a later phase.
export async function POST(request: NextRequest) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // tolerate empty/invalid body in the scaffold
  }

  const id = `SS-${Math.floor(1000 + Math.random() * 9000)}`;

  return Response.json({
    id,
    status: "received",
    placedAt: new Date().toISOString(),
    echo: body,
  });
}

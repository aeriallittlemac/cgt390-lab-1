import type { NextRequest } from "next/server";
import { deleteSession } from "@/lib/session";
import { crossSiteResponse, isCrossSite } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (isCrossSite(request)) return crossSiteResponse();
  await deleteSession();
  return new Response(null, { status: 204 });
}

import deals from "@/data/deals.json";

// Mock deals endpoint.
export async function GET() {
  return Response.json(deals);
}

import menu from "@/data/menu.json";

// Mock menu endpoint. Swap for a CMS/DB query in a later phase.
export async function GET() {
  return Response.json(menu);
}

import { getCurrentUser } from "@/lib/dal";
import { errorResponse } from "@/lib/http";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return errorResponse(401, "Not signed in");
  return Response.json({ user });
}

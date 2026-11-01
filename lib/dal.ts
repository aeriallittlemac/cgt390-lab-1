import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "./session";

// Data Access Layer: the one place pages and API routes ask "who is this?".
// Every authorization decision starts here, not in the proxy or the UI.

/** The signed-in user, or null. Memoized per request. */
export const getCurrentUser = cache(getSessionUser);

/** For pages: the signed-in user, or a redirect to the login page. */
export async function requireUser(returnTo: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

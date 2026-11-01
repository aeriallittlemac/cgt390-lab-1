import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: no session cookie on a members-only page means
// "send to login". It never touches the database, so a present-but-invalid
// cookie passes here and is rejected by the real check in lib/dal.ts.
// Must match lib/session.ts SESSION_COOKIE.
const SESSION_COOKIE = "session";

export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/account/:path*", "/order/:path*", "/tracker/:path*", "/rewards/:path*"],
};

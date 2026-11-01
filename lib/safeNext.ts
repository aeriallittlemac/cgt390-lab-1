/**
 * Returns a same-site path to send the user to after signing in. Anything that
 * could leave the site ("https://…", "//evil.com", "/\evil.com") falls back,
 * so the login page can't be used as an open redirect. Control characters are
 * rejected too, since browsers strip them ("/\t/evil.com" becomes "//evil.com").
 */
export function safeNext(next: unknown, fallback = "/account"): string {
  if (typeof next !== "string" || !next.startsWith("/")) return fallback;
  if (next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}

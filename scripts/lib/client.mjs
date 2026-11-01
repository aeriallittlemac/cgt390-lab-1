// Minimal HTTP client for the test scripts: one cookie jar per simulated user,
// and a reporter that prints evidence with session tokens redacted.

export function createClient(base) {
  let cookie = null;
  return {
    get cookie() {
      return cookie;
    },
    set cookie(value) {
      cookie = value;
    },
    async request(method, path, { body, raw, headers = {} } = {}) {
      const init = { method, headers: { ...headers }, redirect: "manual" };
      if (cookie) init.headers.Cookie = cookie;
      if (body !== undefined || raw !== undefined) {
        init.headers["Content-Type"] ??= "application/json";
        init.body = raw ?? JSON.stringify(body);
      }
      let res;
      try {
        res = await fetch(base + path, init);
      } catch (err) {
        console.error(`Could not reach ${base}: ${err.message}`);
        console.error("Is the dev server running? Start it with: npm run dev");
        process.exit(2);
      }
      const setCookie = res.headers.getSetCookie();
      const session = setCookie.find((c) => c.startsWith("session="));
      if (session) {
        const value = session.split(";")[0];
        cookie = value === "session=" ? null : value;
      }
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        // empty or non-JSON body
      }
      return {
        status: res.status,
        json,
        text,
        location: res.headers.get("location"),
        setCookie: session ?? null,
        retryAfter: res.headers.get("retry-after"),
        contentType: res.headers.get("content-type"),
        sent: { method, path, body: init.body, origin: headers.Origin },
      };
    },
  };
}

/** Replaces the session token so evidence can be shared safely. */
export const redact = (s) => (s ? s.replace(/session=[^;]+/, "session=<redacted>") : s);

export function createReporter() {
  let passed = 0;
  let failed = 0;
  return {
    check(group, name, expect, res, pass, extra = "") {
      if (pass) passed++;
      else failed++;
      const { method, path, body, origin } = res.sent;
      console.log(`\n[${pass ? "PASS" : "FAIL"}] ${group} | ${name}`);
      const sentBody = body && body.length > 300 ? `${body.slice(0, 300)}… (${body.length} chars total)` : body;
      console.log(`  Request:  ${method} ${path}${origin ? ` (Origin: ${origin})` : ""} ${sentBody ?? ""}`);
      console.log(`  Expected: ${expect}`);
      const shown = res.text.length > 600 ? `${res.text.slice(0, 600)}… (${res.text.length} chars total)` : res.text;
      console.log(`  Actual:   ${res.status} ${shown || "(empty body)"}`);
      if (res.location) console.log(`  Location: ${res.location}`);
      if (res.setCookie) console.log(`  Set-Cookie: ${redact(res.setCookie)}`);
      if (extra) console.log(`  Note:     ${extra}`);
    },
    note(text) {
      console.log(`\n[SKIP] ${text}`);
    },
    finish(base) {
      console.log(`\n${passed}/${passed + failed} cases match the contract (${base})`);
      process.exit(failed ? 1 : 0);
    },
  };
}

export const uniqueEmail = (tag) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.test`;

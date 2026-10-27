// Real auth/routes with fixture credentials only; never loads .env or a database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as jose from "jose";

const require = createRequire(import.meta.url);
// Matches next.config.ts; Next's default normalizes 127.0.0.1 to localhost.
process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE = "true";
const { NextRequest } = require("next/server");
const root = new URL("../", import.meta.url);
type Auth = typeof import("../src/lib/admin-auth");
type Middleware = typeof import("../src/middleware");
type Route = { POST: (request: Request) => Promise<Response> };

function fixture() {
  const env: Record<string, string> = { ADMIN_USER: "fixture-admin", ADMIN_PASSWORD: "fixture-only-password" };
  const clock = { now: Date.now() };
  class TestDate extends Date { static now() { return clock.now; } }
  const modules = new Map<string, unknown>();
  function load(file: string): unknown {
    if (modules.has(file)) return modules.get(file);
    const code = ts.transpileModule(readFileSync(new URL(file, root), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const loadedModule = { exports: {} };
    const resolve = (name: string): unknown => {
      if (name === "server-only") return {};
      if (name === "next/server") return require(name);
      if (name === "jose") return {
        ...jose,
        jwtVerify: (token: string, key: Uint8Array, options: jose.JWTVerifyOptions) =>
          jose.jwtVerify(token, key, { ...options, currentDate: new Date(clock.now) }),
      };
      if (name === "@/lib/admin-auth") return load("src/lib/admin-auth.ts");
      throw new Error(`Unisolated dependency: ${name}`);
    };
    new Function("require", "module", "exports", "process", "Date", code)(resolve, loadedModule, loadedModule.exports, { env }, TestDate);
    modules.set(file, loadedModule.exports);
    return loadedModule.exports;
  }
  return {
    env, clock,
    auth: load("src/lib/admin-auth.ts") as Auth,
    middleware: (load("src/middleware.ts") as Middleware).middleware,
    login: (load("src/app/api/auth/login/route.ts") as Route).POST,
    logout: (load("src/app/api/auth/logout/route.ts") as Route).POST,
  };
}

function request(path: string, options: RequestInit = {}) {
  return new NextRequest(`http://127.0.0.1:3101${path}`, options);
}
function loginRequest(body: unknown = { username: "fixture-admin", password: "fixture-only-password" }, extra: HeadersInit = {}) {
  return request("/api/auth/login", {
    method: "POST", headers: { origin: "http://127.0.0.1:3101", "content-type": "application/json", ...extra },
    body: JSON.stringify(body),
  });
}

test("anonymous admin redirects, API returns JSON and neither triggers native auth", async () => {
  const f = fixture();
  const ui = await f.middleware(request("/admin"));
  assert.equal(ui.status, 307);
  assert.equal(ui.headers.get("location"), "http://127.0.0.1:3101/login");
  const api = await f.middleware(request("/api/admin/members"));
  assert.equal(api.status, 401);
  assert.ok((await api.json()).error);
  for (const response of [ui, api]) {
    assert.equal(response.headers.get("www-authenticate"), null);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
  delete f.env.ADMIN_PASSWORD;
  assert.equal((await f.login(loginRequest())).status, 503);
  assert.equal((await f.middleware(request("/api/admin/members"))).status, 503);
  assert.equal(await f.auth.checkAdminCredentials("fixture-admin", "fixture-only-password"), false);
});

test("login accepts only correct credentials, returns protected cookie without a challenge", async () => {
  const f = fixture();
  const wrong = await f.login(loginRequest({ username: "fixture-admin", password: "wrong" }));
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get("www-authenticate"), null);
  assert.equal(wrong.headers.get("set-cookie"), null);
  const success = await f.login(loginRequest());
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { ok: true });
  const cookie = success.headers.get("set-cookie")!;
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=strict/i);
  assert.match(cookie, /Path=\//i);
  assert.match(cookie, /Max-Age=3600/i);
  assert.doesNotMatch(cookie, /fixture|password/i);
  const token = cookie.split(";")[0].split("=")[1];
  assert.equal(await f.auth.verifyAdminSession(token), true);
  assert.equal(success.headers.get("cache-control"), "private, no-store");
  assert.equal(f.auth.adminCookieOptions(request("/")).secure, false);
  assert.equal(f.auth.adminCookieOptions(new Request("https://example.test/")).secure, true);
  assert.equal(f.auth.adminCookieOptions(new Request("http://example.test/")).secure, true);
});

test("signed sessions expire and fail after tampering or credential rotation", async () => {
  const f = fixture();
  const token = await f.auth.createAdminSession();
  assert.equal(await f.auth.verifyAdminSession(token), true);
  const parts = token.split(".");
  parts[1] = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(parts[1], "base64url").toString()), role: "owner" })).toString("base64url");
  assert.equal(await f.auth.verifyAdminSession(parts.join(".")), false);
  assert.equal(await f.auth.verifyAdminSession("invalid"), false);
  assert.equal(await f.auth.verifyAdminSession("a".repeat(2049)), false);
  f.clock.now += 3_601_000;
  assert.equal(await f.auth.verifyAdminSession(token), false);
  f.clock.now = Date.now();
  f.env.ADMIN_PASSWORD = "rotated-fixture-password";
  assert.equal(await f.auth.verifyAdminSession(token), false);
  delete f.env.ADMIN_PASSWORD;
  assert.equal(await f.auth.verifyAdminSession(token), false);
});

test("cookie-auth admin writes require exact same origin", async () => {
  const f = fixture();
  const cookie = `${f.auth.ADMIN_COOKIE}=${await f.auth.createAdminSession()}`;
  const get = await f.middleware(request("/admin", { headers: { cookie } }));
  assert.equal(get.headers.get("x-middleware-next"), "1");
  const rejectedHeaders: HeadersInit[] = [
    { cookie }, { cookie, origin: "https://untrusted.test" },
    { cookie, origin: "http://127.0.0.1:3101", "sec-fetch-site": "cross-site" },
  ];
  for (const headers of rejectedHeaders) {
    assert.equal((await f.middleware(request("/api/admin/members", { method: "POST", headers }))).status, 403);
  }
  const sameSite = await f.middleware(request("/api/admin/members", {
    method: "POST", headers: { cookie, origin: "http://127.0.0.1:3101" },
  }));
  assert.equal(sameSite.headers.get("x-middleware-next"), "1");
});

test("explicit Basic API clients remain compatible, UI requires a session", async () => {
  const f = fixture();
  const authorization = `Basic ${btoa("fixture-admin:fixture-only-password")}`;
  const api = await f.middleware(request("/api/admin/members", { method: "POST", headers: { authorization } }));
  assert.equal(api.headers.get("x-middleware-next"), "1");
  assert.equal((await f.middleware(request("/admin", { headers: { authorization } }))).status, 307);
  assert.equal((await f.middleware(request("/api/admin/members", {
    method: "POST", headers: { authorization, origin: "https://untrusted.test" },
  }))).status, 403);
  for (const invalid of ["Basic malformed", `Basic ${btoa("fixture-admin:wrong")}`]) {
    assert.equal((await f.middleware(request("/api/admin/members", { headers: { authorization: invalid } }))).status, 401);
  }
});

test("login rejects cross-origin, malformed and oversized bodies without setting cookies", async () => {
  const f = fixture();
  for (const origin of ["https://untrusted.test", "null", ""]) {
    assert.equal((await f.login(loginRequest(undefined, { origin }))).status, 403);
  }
  for (const body of [null, [], {}, { username: "fixture-admin", password: 123 }, { username: "x".repeat(257), password: "x" }, { username: "x", password: "x".repeat(5000) }]) {
    const response = await f.login(loginRequest(body));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("set-cookie"), null);
  }
  const malformed = request("/api/auth/login", { method: "POST", headers: { origin: "http://127.0.0.1:3101", "content-type": "application/json" }, body: "{" });
  assert.equal((await f.login(malformed)).status, 400);
  assert.equal((await f.login(loginRequest(undefined, { "content-type": "text/plain" }))).status, 400);
});

test("login throttles attempts despite spoofed IP headers and recovers after the window", async () => {
  const f = fixture();
  for (let i = 0; i < 10; i++) {
    assert.equal((await f.login(loginRequest({ username: "fixture-admin", password: "wrong" }, { "x-forwarded-for": `192.0.2.${i}` }))).status, 401);
  }
  const blocked = await f.login(loginRequest());
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "60");
  assert.equal(blocked.headers.get("set-cookie"), null);
  f.clock.now += 60_000;
  assert.equal((await f.login(loginRequest())).status, 200);
});

test("logout requires same origin and expires the browser cookie", async () => {
  const f = fixture();
  assert.equal((await f.logout(request("/api/auth/logout", { method: "POST" }))).status, 403);
  const response = await f.logout(request("/api/auth/logout", { method: "POST", headers: { origin: "http://127.0.0.1:3101" } }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie")!, /Max-Age=0/i);
  assert.match(response.headers.get("set-cookie")!, /HttpOnly/i);
  assert.equal(response.headers.get("www-authenticate"), null);
});

test("origin checks use browser Host when Next uses an internal listen hostname", () => {
  const f = fixture();
  const local = new Request("http://localhost:3101/api/auth/login", {
    headers: { host: "127.0.0.1:3101", origin: "http://127.0.0.1:3101" },
  });
  assert.equal(f.auth.sameOrigin(local), true);
  assert.equal(f.auth.adminCookieOptions(local).secure, false);
  for (const origin of ["http://localhost:3101", "http://127.0.0.1:3102", "https://untrusted.test"]) {
    const foreign = new Request(local, { headers: { host: "127.0.0.1:3101", origin, "x-forwarded-host": new URL(origin).host } });
    assert.equal(f.auth.sameOrigin(foreign), false);
  }
});

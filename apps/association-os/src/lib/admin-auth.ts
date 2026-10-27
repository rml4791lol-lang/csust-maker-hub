import "server-only";
import { SignJWT, jwtVerify } from "jose";

export const ADMIN_COOKIE = "ai-association-admin";
export const SESSION_SECONDS = 60 * 60;
const issuer = "ai-association-os";
const audience = "admin";
const encoder = new TextEncoder();

export function adminConfigured() {
  return Boolean(process.env.ADMIN_USER && process.env.ADMIN_PASSWORD);
}

async function equalSecret(actual: string, expected: string) {
  const [a, b] = await Promise.all([actual, expected].map(async (value) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))));
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export async function checkAdminCredentials(username: string, password: string) {
  if (!adminConfigured()) return false;
  const [userOk, passwordOk] = await Promise.all([
    equalSecret(username, process.env.ADMIN_USER!),
    equalSecret(password, process.env.ADMIN_PASSWORD!),
  ]);
  return userOk && passwordOk;
}

// Reuse the configured local admin credential without changing .env files.
// PBKDF2 slows offline guessing; rotating credentials invalidates old sessions.
// A separately provisioned ADMIN_SESSION_SECRET is preferred for deployment.
let cachedKey: { input: string; key: Promise<Uint8Array> } | undefined;
async function sessionKey() {
  if (!adminConfigured()) throw new Error("Admin unavailable");
  const input = JSON.stringify([process.env.ADMIN_USER, process.env.ADMIN_PASSWORD, process.env.ADMIN_SESSION_SECRET ?? ""]);
  if (cachedKey?.input !== input) {
    const key = (async () => {
      const material = await crypto.subtle.importKey("raw", encoder.encode(input), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", iterations: 600_000, salt: encoder.encode("ai-association-os/admin-session/v1") }, material, 256);
      return new Uint8Array(bits);
    })();
    cachedKey = { input, key };
  }
  return cachedKey.key;
}

export async function createAdminSession() {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer).setAudience(audience).setSubject("admin")
    .setJti(crypto.randomUUID()).setIssuedAt().setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(await sessionKey());
}

export async function verifyAdminSession(token: string | undefined) {
  if (!adminConfigured() || !token || token.length > 2048) return false;
  try {
    const { payload } = await jwtVerify(token, await sessionKey(), {
      algorithms: ["HS256"], issuer, audience, subject: "admin", maxTokenAge: SESSION_SECONDS,
      requiredClaims: ["exp", "iat", "jti"],
    });
    return payload.role === "admin";
  } catch { return false; }
}

export async function hasAdminSession(request: Request) {
  const part = request.headers.get("cookie")?.split(";").map((value) => value.trim())
    .find((value) => value.startsWith(`${ADMIN_COOKIE}=`));
  return verifyAdminSession(part?.slice(ADMIN_COOKIE.length + 1));
}

export async function hasBasicAdminAuth(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ") || header.length > 4096) return false;
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0)));
    const colon = decoded.indexOf(":");
    return colon >= 0 && await checkAdminCredentials(decoded.slice(0, colon), decoded.slice(colon + 1));
  } catch { return false; }
}

export async function isAdminRequest(request: Request) {
  return await hasAdminSession(request) || await hasBasicAdminAuth(request);
}

// Next's internal request URL can use its listen hostname. Host is the browser's
// target authority; do not trust arbitrary X-Forwarded-Host values here.
function requestTarget(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (host) url.host = host;
  return url;
}

export function sameOrigin(request: Request) {
  return request.headers.get("origin") === requestTarget(request).origin
    && request.headers.get("sec-fetch-site") !== "cross-site";
}

export function adminCookieOptions(request: Request) {
  const url = requestTarget(request);
  const localHttp = url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  return { httpOnly: true, sameSite: "strict" as const, secure: !localHttp, path: "/", maxAge: SESSION_SECONDS };
}

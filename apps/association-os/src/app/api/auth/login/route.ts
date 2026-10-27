import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminConfigured, checkAdminCredentials, createAdminSession, sameOrigin, adminCookieOptions } from "@/lib/admin-auth";

// One local admin account; a bounded process-wide bucket cannot be evaded by
// spoofing IP headers. Distributed deployments need a shared rate limiter.
const bucket = { start: 0, attempts: 0 };
const windowMs = 60_000;
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "请从本站登录页面重试" }, { status: 403, headers });
  if (!adminConfigured()) return NextResponse.json({ error: "管理后台暂未启用，请联系平台负责人" }, { status: 503, headers });
  const now = Date.now();
  if (now - bucket.start >= windowMs) { bucket.start = now; bucket.attempts = 0; }
  if (++bucket.attempts > 10) return NextResponse.json({ error: "尝试过于频繁，请一分钟后再试" }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "登录信息格式不正确" }, { status: 400, headers });
  let values: unknown;
  try {
    // Limit streamed input too; Content-Length alone is not a trusted bound.
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing body");
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 4096) { await reader.cancel(); throw new Error("Body too large"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    values = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return NextResponse.json({ error: "登录信息格式不正确" }, { status: 400, headers }); }
  if (!values || typeof values !== "object" || Array.isArray(values)) return NextResponse.json({ error: "请输入账号和密码" }, { status: 400, headers });
  const { username, password } = values as Record<string, unknown>;
  if (typeof username !== "string" || typeof password !== "string" || !username || !password || username.length > 256 || password.length > 1024) return NextResponse.json({ error: "请输入有效的账号和密码" }, { status: 400, headers });
  if (!await checkAdminCredentials(username, password)) return NextResponse.json({ error: "账号或密码不正确" }, { status: 401, headers });
  const response = NextResponse.json({ ok: true }, { headers });
  response.cookies.set(ADMIN_COOKIE, await createAdminSession(), adminCookieOptions(request));
  return response;
}

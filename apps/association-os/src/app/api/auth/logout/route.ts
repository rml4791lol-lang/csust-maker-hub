import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions, sameOrigin } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!sameOrigin(request)) return NextResponse.json({ error: "请求来源不受信任" }, { status: 403, headers });
  const response = NextResponse.json({ ok: true }, { headers });
  response.cookies.set(ADMIN_COOKIE, "", { ...adminCookieOptions(request), maxAge: 0 });
  return response;
}

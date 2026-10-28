import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminConfigured, hasAdminSession, hasBasicAdminAuth, sameOrigin } from "@/lib/admin-auth";

/**
 * 管理后台认证：站内登录会话；保留显式 Basic API 客户端兼容。
 *
 * 保护范围：
 *  - /admin/**       管理界面
 *  - /api/admin/**   管理 CRUD 接口
 *
 * 凭据来自 .env.local：
 *  - ADMIN_USER
 *  - ADMIN_PASSWORD
 *
 * 不发 WWW-Authenticate，避免浏览器原生弹窗阻断公开页面。
 * 未配置凭据时管理 API 返回 503，匿名访问始终不允许写入。
 */
export async function middleware(request: NextRequest) {
  const api = request.nextUrl.pathname.startsWith("/api/");
  const cookieAuth = await hasAdminSession(request);
  // Legacy API clients may still provide Basic credentials explicitly. Browser
  // navigation uses only the session, and no response issues an auth challenge.
  const basicAuth = api && await hasBasicAdminAuth(request);
  const headers = { "Cache-Control": "private, no-store" };
  if (cookieAuth || basicAuth) {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)
      && !sameOrigin(request) && !(basicAuth && !request.headers.has("origin"))) {
      return NextResponse.json({ error: "请求来源不受信任，请重新打开后台" }, { status: 403, headers });
    }
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  if (api) return NextResponse.json({ error: adminConfigured() ? "登录已失效，请重新登录" : "管理后台暂未启用" }, { status: adminConfigured() ? 401 : 503, headers });
  return NextResponse.redirect(new URL("/login", request.url), { headers });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
  runtime: "nodejs",
};

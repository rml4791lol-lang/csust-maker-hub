import { NextResponse } from "next/server";
import { connection } from "next/server";

/**
 * 标记 Route Handler 为动态（Next.js 16 cacheComponents 下默认会静态缓存 API）。
 * 不调用它，GET API 会被预渲染成静态响应，数据库更新不会反映。
 */
export async function ensureDynamic() {
  await connection();
}

/** 统一 JSON 响应：显式带 charset=utf-8，避免中文被客户端按 Latin-1 解码 */
export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

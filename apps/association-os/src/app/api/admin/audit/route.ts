import { ensureDynamic, json } from "@/lib/api";
import { listAudit } from "@/lib/audit";

/** 审计日志（最近 N 条） */
export async function GET(request: Request) {
  await ensureDynamic();
  const { searchParams } = new URL(request.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? 100)));
  return json(listAudit(limit));
}

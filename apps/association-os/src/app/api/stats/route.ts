import { ensureDynamic, json } from "@/lib/api";
import { getDb } from "@/lib/db";

/** 首页统计（从数据库实时计算，不手填） */
export async function GET() {
  await ensureDynamic();
  const db = getDb();
  const one = (sql: string) =>
    (db.prepare(sql).get() as { c: number }).c;

  return json({
    members: one("SELECT COUNT(*) AS c FROM members"),
    items: one("SELECT COUNT(*) AS c FROM items"),
    projects: one("SELECT COUNT(*) AS c FROM projects"),
    competitions: one("SELECT COUNT(*) AS c FROM competitions"),
    activities: one("SELECT COUNT(*) AS c FROM activities"),
    awards: one("SELECT COUNT(*) AS c FROM awards"),
    contributions: one("SELECT COUNT(*) AS c FROM contributions"),
    pendingContributions: one(
      "SELECT COUNT(*) AS c FROM contributions WHERE status = 'pending'",
    ),
  });
}

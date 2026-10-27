import { ensureDynamic, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

const BUSINESS_TABLES = [
  // 先删除引用 departments 的成员，保持外键检查开启。
  "members",
  "departments",
  "items",
  "projects",
  "competitions",
  "activities",
  "awards",
  "contributions",
];

/**
 * 清空示例数据（危险操作）
 * 用于「换成真实数据」前清空 seed 数据。
 * 需要 body: { confirm: "CLEAR" }
 */
export async function POST(request: Request) {
  await ensureDynamic();

  let body: { confirm?: string };
  try {
    body = (await request.json()) as { confirm?: string };
  } catch {
    return json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body) || body.confirm !== "CLEAR") {
    return json(
      { error: "需要确认：请求体传 { confirm: \"CLEAR\" }" },
      { status: 400 },
    );
  }

  const db = getDb();
  const removed: Record<string, number> = {};

  db.exec("BEGIN");
  try {
    for (const t of BUSINESS_TABLES) {
      const row = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as {
        c: number;
      };
      removed[t] = row.c;
      db.prepare(`DELETE FROM ${t}`).run();
    }
    // 标记：数据来源已清空，等待真实录入
    db.prepare(
      "INSERT OR REPLACE INTO meta (key, value) VALUES ('data_source', 'cleared')",
    ).run();
    db.prepare(
      "INSERT OR REPLACE INTO meta (key, value) VALUES ('cleared_at', ?)",
    ).run(new Date().toISOString());
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    console.error("[admin] clear data failed:", e);
    return json({ error: "清空失败" }, { status: 500 });
  }

  writeAudit({
    table: "__all__",
    recordId: "*",
    action: "delete",
    before: removed,
  });

  return json({ ok: true, removed });
}

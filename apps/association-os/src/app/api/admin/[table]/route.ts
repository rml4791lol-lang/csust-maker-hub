import { ensureDynamic, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getTableDef, decodeRow, encodeValue, validateFields } from "@/lib/admin-schema";
import { writeAudit } from "@/lib/audit";
import { randomUUID } from "node:crypto";
import { adminWriteError, isAdminRequest } from "@/lib/admin-auth";
import { ArticleMediaError, bindArticleMedia } from "@/lib/article-media";

/** 通用列表 + 新增（/api/admin/<table>） */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ table: string }> },
) {
  await ensureDynamic();
  if (!await isAdminRequest(request)) return json({ error: "请先登录" }, { status: 401 });
  const { table } = await params;
  const def = getTableDef(table);
  if (!def) return json({ error: "unknown table" }, { status: 404 });

  const db = getDb();
  const rows = db.prepare(`SELECT * FROM ${table}`).all() as Record<
    string,
    unknown
  >[];
  return json(rows.map((r) => decodeRow(r, def)));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ table: string }> },
) {
  await ensureDynamic();
  const denied = await adminWriteError(request);
  if (denied) return json({ error: denied.error }, { status: denied.status });
  const { table } = await params;
  const def = getTableDef(table);
  if (!def) return json({ error: "unknown table" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "请求内容必须是对象" }, { status: 400 });
  }

  const invalid = validateFields(body, def);
  if (invalid) return json({ error: invalid }, { status: 400 });
  if (table === "activities" && Number(body.joined ?? 0) > Number(body.capacity ?? 0)) return json({ error: "已报名人数不能超过名额" }, { status: 400 });

  const db = getDb();
  const row: Record<string, unknown> = {};
  for (const f of def.fields) {
    row[f.key] = encodeValue(body[f.key], f);
  }
  if (table === "items" && !row.status) row.status = "草稿";
  if (table === "items" && !row.body_format) row.body_format = "plain";
  if (table === "contributions" && !row.status) row.status = "draft";

  // 自动填充 created_at（部分表 NOT NULL）
  if (table === "contributions" && !row.created_at) {
    row.created_at = new Date().toISOString();
  }

  // 标识符不依赖文本排序或毫秒时间，避免跨百位及同毫秒碰撞。
  if (!row[def.pk] || row[def.pk] === "") {
    row[def.pk] = `${def.idPrefix ?? ""}${randomUUID()}`;
  }
  if (def.stableKey) row[def.stableKey] = `${def.idPrefix ?? ""}${randomUUID()}`;

  const cols = Object.keys(row);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols
        .map(() => "?")
        .join(", ")})`,
    ).run(...(cols.map((c) => row[c]) as never[]));
    if (table === "items") bindArticleMedia(db, String(row.id), String(row.body), String(row.body_format));
    writeAudit({ table, recordId: String(row[def.stableKey ?? def.pk]), action: "create", after: row });
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    if (e instanceof ArticleMediaError) return json({ error: e.message }, { status: 400 });
    // 错误脱敏：详细原因只进服务端日志，不回客户端
    console.error(`[admin] insert ${table} failed:`, e);
    return json({ error: "写入失败，请检查字段是否合法" }, { status: 400 });
  }

  return json(decodeRow(row, def), { status: 201 });
}

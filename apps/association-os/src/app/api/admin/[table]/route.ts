import { ensureDynamic, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { TABLE_DEFS, decodeRow, encodeValue } from "@/lib/admin-schema";
import { writeAudit } from "@/lib/audit";
import { randomUUID } from "node:crypto";

/** 通用列表 + 新增（/api/admin/<table>） */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ table: string }> },
) {
  await ensureDynamic();
  const { table } = await params;
  const def = TABLE_DEFS[table];
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
  const { table } = await params;
  const def = TABLE_DEFS[table];
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

  for (const f of def.fields) {
    const v = body[f.key];
    if (f.required && (v === undefined || v === null || v === "")) {
      return json({ error: `${f.label} 为必填` }, { status: 400 });
    }
  }

  const db = getDb();
  const row: Record<string, unknown> = {};
  for (const f of def.fields) {
    row[f.key] = encodeValue(body[f.key], f);
  }

  // 自动填充 created_at（部分表 NOT NULL）
  if (table === "contributions" && !row.created_at) {
    row.created_at = new Date().toISOString();
  }

  // 标识符不依赖文本排序或毫秒时间，避免跨百位及同毫秒碰撞。
  if (!row[def.pk] || row[def.pk] === "") {
    row[def.pk] = `${def.idPrefix ?? ""}${randomUUID()}`;
  }

  const cols = Object.keys(row);
  try {
    db.prepare(
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols
        .map(() => "?")
        .join(", ")})`,
    ).run(...(cols.map((c) => row[c]) as never[]));
  } catch (e) {
    // 错误脱敏：详细原因只进服务端日志，不回客户端
    console.error(`[admin] insert ${table} failed:`, e);
    return json({ error: "写入失败，请检查字段是否合法" }, { status: 400 });
  }

  writeAudit({
    table,
    recordId: String(row[def.pk]),
    action: "create",
    after: row,
  });

  return json(row, { status: 201 });
}

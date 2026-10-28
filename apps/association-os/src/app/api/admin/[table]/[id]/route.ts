import { ensureDynamic, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getTableDef, encodeValue, decodeRow, validateFields, type TableDef } from "@/lib/admin-schema";
import { writeAudit } from "@/lib/audit";
import { FLOWS, canTransition } from "@/lib/workflow";
import { adminWriteError, isAdminRequest } from "@/lib/admin-auth";
import { ArticleMediaError, bindArticleMedia } from "@/lib/article-media";

type Context = { params: Promise<{ table: string; id: string }> };

/** New callers use stable IDs; old admin clients can still use project names. */
function findRecord(def: TableDef, id: string) {
  const db = getDb();
  if (def.stableKey) {
    const row = db.prepare(`SELECT * FROM ${def.key} WHERE ${def.stableKey} = ?`).get(id);
    if (row) return row as Record<string, unknown>;
  }
  return db.prepare(`SELECT * FROM ${def.key} WHERE ${def.pk} = ?`).get(id) as Record<string, unknown> | undefined;
}

export async function GET(request: Request, { params }: Context) {
  await ensureDynamic();
  if (!await isAdminRequest(request)) return json({ error: "请先登录" }, { status: 401 });
  const { table, id } = await params;
  const def = getTableDef(table);
  if (!def) return json({ error: "unknown table" }, { status: 404 });
  const row = findRecord(def, id);
  return row ? json(decodeRow(row, def)) : json({ error: "not found" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: Context) {
  await ensureDynamic();
  const denied = await adminWriteError(request);
  if (denied) return json({ error: denied.error }, { status: denied.status });
  const { table, id } = await params;
  const def = getTableDef(table);
  if (!def) return json({ error: "unknown table" }, { status: 404 });
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return json({ error: "invalid JSON" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "请求内容必须是对象" }, { status: 400 });
  const invalid = validateFields(body, def, true);
  if (invalid) return json({ error: invalid }, { status: 400 });

  const before = findRecord(def, id);
  if (!before) return json({ error: "not found" }, { status: 404 });
  const flowDef = FLOWS[table];
  if (flowDef && body[flowDef.field] !== undefined) {
    const from = String(before[flowDef.field] ?? "");
    const to = String(body[flowDef.field]);
    if (!canTransition(flowDef.flow, from, to)) return json({ error: `${flowDef.label}不能从「${from}」直接变为「${to}」` }, { status: 400 });
  }
  if (table === "activities" && Number(body.joined ?? before.joined) > Number(body.capacity ?? before.capacity)) return json({ error: "已报名人数不能超过名额" }, { status: 400 });

  const changes: Record<string, unknown> = {};
  for (const field of def.fields) {
    if (body[field.key] !== undefined) changes[field.key] = encodeValue(body[field.key], field);
  }
  const keys = Object.keys(changes);
  if (!keys.length) return json({ error: "no fields" }, { status: 400 });
  const db = getDb();
  const key = def.stableKey ?? def.pk;
  const recordId = String(before[key]);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`UPDATE ${table} SET ${keys.map(k => `${k} = ?`).join(", ")} WHERE ${key} = ?`)
      .run(...(keys.map(k => changes[k]) as never[]), recordId);
    // This is an existing exact text association, not an inferred relationship.
    if (table === "projects" && changes.name && changes.name !== before.name) {
      db.prepare("UPDATE contributions SET project = ? WHERE project = ?").run(String(changes.name), String(before.name));
    }
    const after = { ...before, ...changes };
    if (table === "items") bindArticleMedia(db, recordId, String(after.body), String(after.body_format));
    writeAudit({ table, recordId, action: "update", before, after });
    db.exec("COMMIT");
    return json({ ok: true, id: recordId, record: decodeRow(after, def) });
  } catch (error) {
    db.exec("ROLLBACK");
    if (error instanceof ArticleMediaError) return json({ error: error.message }, { status: 400 });
    console.error(`[admin] update ${table} failed:`, error);
    return json({ error: "更新失败，请检查字段是否合法" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  await ensureDynamic();
  const denied = await adminWriteError(request);
  if (denied) return json({ error: denied.error }, { status: denied.status });
  const { table, id } = await params;
  const def = getTableDef(table);
  if (!def) return json({ error: "unknown table" }, { status: 404 });
  const before = findRecord(def, id);
  if (!before) return json({ error: "not found" }, { status: 404 });
  const db = getDb();
  const key = def.stableKey ?? def.pk;
  const recordId = String(before[key]);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`DELETE FROM ${table} WHERE ${key} = ?`).run(recordId);
    writeAudit({ table, recordId, action: "delete", before });
    db.exec("COMMIT");
    return json({ ok: true });
  } catch (error) {
    db.exec("ROLLBACK");
    console.error(`[admin] delete ${table} failed:`, error);
    return json({ error: "删除失败，请稍后重试" }, { status: 400 });
  }
}

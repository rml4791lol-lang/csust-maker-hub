import { ensureDynamic, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { TABLE_DEFS, encodeValue } from "@/lib/admin-schema";
import { writeAudit } from "@/lib/audit";
import { FLOWS, canTransition } from "@/lib/workflow";

/** 单条编辑 / 删除（/api/admin/<table>/<id>） */

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ table: string; id: string }> },
) {
  await ensureDynamic();
  const { table, id } = await params;
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

  // 必填字段不允许被改成空值
  for (const f of def.fields) {
    if (
      f.required &&
      body[f.key] !== undefined &&
      (body[f.key] === "" || body[f.key] === null)
    ) {
      return json({ error: `${f.label} 不能为空` }, { status: 400 });
    }
  }

  const db = getDb();
  const before = db
    .prepare(`SELECT * FROM ${table} WHERE ${def.pk} = ?`)
    .get(id) as Record<string, unknown> | undefined;
  if (!before) return json({ error: "not found" }, { status: 404 });

  // 状态流转规则：防止绕过审核直接改状态
  const flowDef = FLOWS[table];
  if (flowDef && body[flowDef.field] !== undefined) {
    const from = String(before[flowDef.field] ?? "");
    const to = String(body[flowDef.field]);
    if (!canTransition(flowDef.flow, from, to)) {
      return json(
        {
          error: `${flowDef.label}不能从「${from}」直接变为「${to}」`,
        },
        { status: 400 },
      );
    }
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const f of def.fields) {
    if (body[f.key] !== undefined) {
      sets.push(`${f.key} = ?`);
      values.push(encodeValue(body[f.key], f));
    }
  }
  if (sets.length === 0) return json({ error: "no fields" }, { status: 400 });

  try {
    db.prepare(`UPDATE ${table} SET ${sets.join(", ")} WHERE ${def.pk} = ?`).run(
      ...(values as never[]),
      id,
    );

    writeAudit({
      table,
      recordId: id,
      action: "update",
      before,
      after: { ...before, ...body },
    });

    return json({ ok: true });
  } catch (e) {
    // 错误脱敏
    console.error(`[admin] update ${table}/${id} failed:`, e);
    return json({ error: "更新失败，请检查字段是否合法" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ table: string; id: string }> },
) {
  await ensureDynamic();
  const { table, id } = await params;
  const def = TABLE_DEFS[table];
  if (!def) return json({ error: "unknown table" }, { status: 404 });

  const db = getDb();
  const before = db
    .prepare(`SELECT * FROM ${table} WHERE ${def.pk} = ?`)
    .get(id) as Record<string, unknown> | undefined;
  if (!before) return json({ error: "not found" }, { status: 404 });

  db.prepare(`DELETE FROM ${table} WHERE ${def.pk} = ?`).run(id);

  writeAudit({
    table,
    recordId: id,
    action: "delete",
    before,
  });

  return json({ ok: true });
}

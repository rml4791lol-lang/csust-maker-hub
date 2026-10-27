// ============================================================
// 审计日志：记录管理后台的每一次写操作
// ============================================================

import { getDb } from "./db";

export type AuditAction = "create" | "update" | "delete";

export interface AuditEntry {
  id?: number;
  at: string;
  actor: string;
  table_name: string;
  record_id: string;
  action: AuditAction;
  before_json: string | null;
  after_json: string | null;
}

/** 写一条审计记录（失败不阻断主流程，仅打日志） */
export function writeAudit(entry: {
  actor?: string;
  table: string;
  recordId: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
}) {
  try {
    const db = getDb();
    db.prepare(
      "INSERT INTO audit_log (at, actor, table_name, record_id, action, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(
      new Date().toISOString(),
      entry.actor ?? "admin",
      entry.table,
      entry.recordId,
      entry.action,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
    );
  } catch (e) {
    console.error("[audit] write failed:", e);
  }
}

/** 最近的审计记录 */
export function listAudit(limit = 100): AuditEntry[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM audit_log ORDER BY at DESC LIMIT ?")
    .all(limit) as unknown as AuditEntry[];
}

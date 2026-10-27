import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

type FootprintInput = {
  member: string;
  content: string;
  project: string;
  dept: string;
  date: string;
  hours: number;
};

export type FootprintAttachment = {
  name: string;
  path: string;
  size: number;
  type: string;
};

type RateRecord = { count: number; resetAt: number };
// 保存在进程全局，避免两个 Route bundle 各持一份额度。
const rateScope = globalThis as typeof globalThis & {
  __aiAssociationFootprintRate?: Map<string, RateRecord>;
};
const RATE = rateScope.__aiAssociationFootprintRate ??= new Map<string, RateRecord>();
const LIMIT = 10;
const WINDOW = 60 * 60 * 1000;

/**
 * 两个提交入口共享单进程限流。兼容现有 forwarded header 取值。
 * 部署前须验证入口代理会覆盖客户端转发头；未经验证的头可伪造，
 * 此逻辑不构成可靠的按 IP 反滥用边界，也不支持跨实例共享配额。
 */
export function footprintRetryAfter(request: Request): number {
  const now = Date.now();
  for (const [key, record] of RATE) {
    if (record.resetAt <= now) RATE.delete(key);
  }
  const key =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "local";
  const record = RATE.get(key);
  if (!record) {
    RATE.set(key, { count: 1, resetAt: now + WINDOW });
    return 0;
  }
  if (record.count >= LIMIT) {
    return Math.max(1, Math.ceil((record.resetAt - now) / 1000));
  }
  record.count++;
  return 0;
}

/** 公共入口使用同一列集合和公开状态条件。 */
export function listPublicFootprints() {
  return getDb()
    .prepare(
      `SELECT id, member, author_dept, date, content, project, hours,
              attachment_name, attachment_path, attachment_size, attachment_type,
              created_at
       FROM contributions
       WHERE status = 'approved'
       ORDER BY date DESC, created_at DESC
       LIMIT 200`,
    )
    .all();
}

export function validateFootprintInput(
  body: unknown,
): { value: FootprintInput; error?: never } | { error: string; value?: never } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "请求内容必须是对象" };
  }
  const input = body as Record<string, unknown>;
  for (const key of ["member", "content", "project", "dept", "date"]) {
    if (input[key] != null && typeof input[key] !== "string") {
      return { error: "文本字段格式错误" };
    }
  }
  const member = String(input.member ?? "").trim();
  const content = String(input.content ?? "").trim();
  const project = String(input.project ?? "").trim();
  const dept = String(input.dept ?? "").trim();
  const rawDate = String(input.date ?? "").trim();
  if (!member) return { error: "请填写姓名" };
  if (!content) return { error: "请填写做了什么" };
  if (member.length > 20) return { error: "姓名过长" };
  if (content.length > 500) return { error: "内容过长（≤500 字）" };
  if (dept.length > 20 || project.length > 40) {
    return { error: "部门或项目名过长" };
  }
  const hoursValue = input.hours ?? 0;
  if (typeof hoursValue !== "string" && typeof hoursValue !== "number") {
    return { error: "工时必须是 0 至 24 之间的数字" };
  }
  const hours = Number(hoursValue);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
    return { error: "工时必须是 0 至 24 之间的数字" };
  }
  // 当前产品日期格式为 MM-DD；用闰年校验月日，保留 02-29。
  if (rawDate) {
    const parsed = new Date(`2000-${rawDate}T00:00:00.000Z`);
    if (
      !/^\d{2}-\d{2}$/.test(rawDate) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(5, 10) !== rawDate
    ) {
      return { error: "日期格式应为有效的 MM-DD" };
    }
  }
  const now = new Date();
  const date = rawDate ||
    `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return { value: { member, content, project, dept, date, hours } };
}

/** 足迹是公开记录，两个入口都保持提交即公开。 */
export function createFootprint(
  input: FootprintInput,
  attachment: FootprintAttachment | null = null,
) {
  const id = `f${randomUUID()}`;
  getDb().prepare(
    `INSERT INTO contributions
      (id, member, author_dept, date, content, project, hours, status, created_at,
       attachment_name, attachment_path, attachment_size, attachment_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?)`,
  ).run(
    id, input.member, input.dept || null, input.date, input.content,
    input.project || null, input.hours, new Date().toISOString(),
    attachment?.name ?? null, attachment?.path ?? null,
    attachment?.size ?? null, attachment?.type ?? null,
  );
  writeAudit({
    actor: input.member,
    table: "contributions",
    recordId: id,
    action: "create",
    after: { member: input.member, content: input.content, hasAttachment: Boolean(attachment) },
  });
  return { ok: true, id, status: "approved", hasAttachment: Boolean(attachment) };
}

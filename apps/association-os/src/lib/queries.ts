// ============================================================
// 数据库查询层（服务端用）：所有页面数据都从这里取，不再读 mock-data
// ============================================================

import { getDb } from "./db";

/* ---------------- 类型 ---------------- */

export interface MemberRow {
  id: string;
  name: string;
  dept: string;
  role: string | null;
  grade: string;
  skills: string[];
}

export interface ItemRow {
  id: string;
  title: string;
  type: string;
  topic: string;
  author: string;
  summary: string;
  tags: string[];
  status: string;
  updated: string;
}

export interface ProjectRow {
  name: string;
  owner: string;
  status: string;
  updated: string;
}

export interface CompetitionRow {
  id: string;
  name: string;
  level: string;
  host: string;
  status: string;
  deadline: string;
  teams: number;
  members: string[];
}

export interface ActivityRow {
  id: string;
  title: string;
  kind: string;
  date: string;
  place: string;
  status: string;
  joined: number;
  capacity: number;
}

export interface AwardRow {
  id: string;
  title: string;
  level: string;
  competition: string;
  members: string[];
  date: string;
  has_certificate: number;
}

export interface ContributionRow {
  id: string;
  member: string;
  date: string;
  content: string;
  project: string | null;
  hours: number;
  status: string;
  created_at: string;
}

export interface DepartmentRow {
  name: string;
  lead: string;
  active: number;
  contributions: number;
}

/* ---------------- 工具 ---------------- */

function parseJson<T>(raw: unknown, fallback: T): T {
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function all<T>(sql: string): T[] {
  return getDb().prepare(sql).all() as T[];
}

/* ---------------- 基础查询 ---------------- */

export function listMembers(): MemberRow[] {
  const rows = all<Record<string, unknown>>("SELECT * FROM members ORDER BY id");
  return rows.map(
    (r) => ({ ...r, skills: parseJson<string[]>(r.skills, []) }) as MemberRow,
  );
}

export function listItems(): ItemRow[] {
  const rows = all<Record<string, unknown>>(
    "SELECT * FROM items ORDER BY updated DESC",
  );
  return rows.map(
    (r) => ({ ...r, tags: parseJson<string[]>(r.tags, []) }) as ItemRow,
  );
}

export function listProjects(): ProjectRow[] {
  return all<ProjectRow>("SELECT * FROM projects ORDER BY updated DESC");
}

export function listCompetitions(): CompetitionRow[] {
  const rows = all<Record<string, unknown>>(
    "SELECT * FROM competitions ORDER BY deadline",
  );
  return rows.map(
    (r) => ({ ...r, members: parseJson<string[]>(r.members, []) }) as CompetitionRow,
  );
}

export function listActivities(): ActivityRow[] {
  return all<ActivityRow>("SELECT * FROM activities ORDER BY date DESC");
}

export function listAwards(): AwardRow[] {
  const rows = all<Record<string, unknown>>(
    "SELECT * FROM awards ORDER BY date DESC",
  );
  return rows.map(
    (r) => ({ ...r, members: parseJson<string[]>(r.members, []) }) as AwardRow,
  );
}

export function listContributions(): ContributionRow[] {
  return all<ContributionRow>(
    "SELECT * FROM contributions ORDER BY created_at DESC",
  );
}

export function listDepartments(): DepartmentRow[] {
  return all<DepartmentRow>(
    `SELECT d.name, d.lead,
      (SELECT COUNT(*) FROM members m WHERE m.dept = d.name) AS active,
      (SELECT COUNT(*) FROM contributions c
       WHERE c.author_dept = d.name AND c.status = 'approved') AS contributions
     FROM departments d ORDER BY active DESC, d.name`,
  );
}

/* ---------------- 派生数据（不再手填） ---------------- */

/** 首页统计：全部从数据库实时计算 */
export function getStats() {
  const db = getDb();
  const one = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
  return {
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
  };
}

/** 项目状态分布：从 projects 实际分组 */
export function getProjectStatusFlow() {
  const groups = all<{ status: string; c: number }>(
    "SELECT status, COUNT(*) AS c FROM projects GROUP BY status",
  );
  const order = ["立项", "开发中", "答辩准备", "已结项", "孵化中"];
  return order.map((label) => ({
    label,
    count: groups.find((g) => g.status === label)?.c ?? 0,
  }));
}

/** 内容类型分布：从 items 实际分组 */
export function getContentTypeCounts() {
  const groups = all<{ type: string; c: number }>(
    "SELECT type, COUNT(*) AS c FROM items GROUP BY type",
  );
  return (t: string) => groups.find((g) => g.type === t)?.c ?? 0;
}

/** 内容主题分布 */
export function getTopicCounts() {
  const groups = all<{ topic: string; c: number }>(
    "SELECT topic, COUNT(*) AS c FROM items GROUP BY topic",
  );
  return (t: string) => groups.find((g) => g.topic === t)?.c ?? 0;
}

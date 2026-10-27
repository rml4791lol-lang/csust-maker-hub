import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { runMigrations } from "./migrate";
import {
  departments,
  members,
  items,
  competitions,
  projects,
  activityList,
  awardList,
} from "./mock-data";

// An explicit directory lets previews and integration checks use isolated data.
const DATA_DIR = process.env.AI_ASSOCIATION_DATA_DIR
  ? path.resolve(process.env.AI_ASSOCIATION_DATA_DIR)
  : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

let _db: DatabaseSync | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS departments (
  name TEXT PRIMARY KEY,
  lead TEXT NOT NULL,
  active INTEGER NOT NULL,
  contributions INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dept TEXT NOT NULL,
  role TEXT,
  grade TEXT NOT NULL,
  skills TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  topic TEXT NOT NULL,
  author TEXT NOT NULL,
  summary TEXT NOT NULL,
  tags TEXT NOT NULL,
  status TEXT NOT NULL,
  updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT NOT NULL,
  host TEXT NOT NULL,
  status TEXT NOT NULL,
  deadline TEXT NOT NULL,
  teams INTEGER NOT NULL,
  members TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  name TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  status TEXT NOT NULL,
  updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  date TEXT NOT NULL,
  place TEXT NOT NULL,
  status TEXT NOT NULL,
  joined INTEGER NOT NULL,
  capacity INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS awards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  level TEXT NOT NULL,
  competition TEXT NOT NULL,
  members TEXT NOT NULL,
  date TEXT NOT NULL,
  has_certificate INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS contributions (
  id TEXT PRIMARY KEY,
  member TEXT NOT NULL,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  project TEXT,
  hours INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

/* 元信息：数据来源、seed 时间、schema 版本 */
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

/* 审计日志：谁在什么时候改了什么 */
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at DESC);
`;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  try {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(SCHEMA);
    seed(db);
    runMigrations(db);
    return (_db = db);
  } catch (error) {
    db.close();
    throw error;
  }
}

function count(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as {
    c: number;
  };
  return row.c;
}

function seed(db: DatabaseSync) {
  const setMeta = db.prepare(
    "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
  );

  // 1) 已有 seed 标记 → 跳过
  const seeded = db
    .prepare("SELECT value FROM meta WHERE key = 'seeded_at'")
    .get() as { value?: string } | undefined;
  if (seeded) return;

  // 2) 旧库兼容：表里已有数据但没有标记（升级前创建的库）→ 补标记，不重复插入
  if (count(db, "members") > 0) {
    const stamp = new Date().toISOString();
    setMeta.run("seeded_at", stamp);
    setMeta.run("data_source", "seed");
    const ver = db
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value?: string } | undefined;
    if (!ver) setMeta.run("schema_version", "1");
    return;
  }

  db.exec("BEGIN");
  try {
    seedAll(db);
    const stamp = new Date().toISOString();
    setMeta.run("seeded_at", stamp);
    setMeta.run("data_source", "seed");
    setMeta.run("schema_version", "1");
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

function seedAll(db: DatabaseSync) {
  const insDept = db.prepare(
    "INSERT INTO departments (name, lead, active, contributions) VALUES (?, ?, ?, ?)",
  );
  for (const d of departments) insDept.run(d.name, d.lead, d.active, d.contributions);

  const insMember = db.prepare(
    "INSERT INTO members (id, name, dept, role, grade, skills) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const m of members)
    insMember.run(m.id, m.name, m.dept, m.role ?? null, m.grade, JSON.stringify(m.skills));

  const insItem = db.prepare(
    "INSERT INTO items (id, title, type, topic, author, summary, tags, status, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const i of items)
    insItem.run(
      i.id,
      i.title,
      i.type,
      i.topic,
      i.author,
      i.summary,
      JSON.stringify(i.tags),
      i.status,
      i.updated,
    );

  const insComp = db.prepare(
    "INSERT INTO competitions (id, name, level, host, status, deadline, teams, members) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const c of competitions)
    insComp.run(
      c.id,
      c.name,
      c.level,
      c.host,
      c.status,
      c.deadline,
      c.teams,
      JSON.stringify(c.members),
    );

  const insProject = db.prepare(
    "INSERT INTO projects (name, owner, status, updated) VALUES (?, ?, ?, ?)",
  );
  for (const p of projects) insProject.run(p.name, p.owner, p.status, p.updated);

  const insAct = db.prepare(
    "INSERT INTO activities (id, title, kind, date, place, status, joined, capacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const a of activityList)
    insAct.run(a.id, a.title, a.kind, a.date, a.place, a.status, a.joined, a.capacity);

  const insAward = db.prepare(
    "INSERT INTO awards (id, title, level, competition, members, date, has_certificate) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  for (const a of awardList)
    insAward.run(
      a.id,
      a.title,
      a.level,
      a.competition,
      JSON.stringify(a.members),
      a.date,
      a.hasCertificate ? 1 : 0,
    );

  const insContribution = db.prepare(
    "INSERT INTO contributions (id, member, date, content, project, hours, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  insContribution.run("c1", "陈屿", "10-25", "完成主页 hero 与内容结构重排", "协会数字平台", 3, "pending", new Date().toISOString());
  insContribution.run("c2", "陈屿", "10-24", "整理软著申请材料第 2 版", "软著材料自动化", 2, "approved", new Date().toISOString());
  insContribution.run("c3", "陈屿", "10-23", "主持技术部周会并整理会议纪要", null, 1, "approved", new Date().toISOString());
}

/** 读取 meta 标记（数据来源、seed 时间、schema 版本） */
export function getMeta(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM meta").all() as Array<{
    key: string;
    value: string;
  }>;
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

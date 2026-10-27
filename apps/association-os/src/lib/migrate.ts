// ============================================================
// 数据库迁移：版本化、事务化
// ============================================================

import type { DatabaseSync } from "node:sqlite";

export interface Migration {
  version: number;
  name: string;
  disableForeignKeys?: boolean;
  up: (db: DatabaseSync) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial schema",
    // v1 的表结构已由 SCHEMA 常量创建，这里只作版本标记
    up: () => {},
  },
  {
    version: 2,
    name: "add foreign keys (members.dept -> departments.name)",
    disableForeignKeys: true,
    up: (db) => {
      db.exec(`
          CREATE TABLE members_new (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            dept TEXT NOT NULL REFERENCES departments(name)
              ON UPDATE CASCADE ON DELETE RESTRICT,
            role TEXT,
            grade TEXT NOT NULL,
            skills TEXT NOT NULL
          );
          INSERT INTO members_new (id, name, dept, role, grade, skills)
            SELECT id, name, dept, role, grade, skills FROM members;
          DROP TABLE members;
          ALTER TABLE members_new RENAME TO members;
      `);
    },
  },
  {
    version: 3,
    name: "attachments for footprints (足迹材料上传)",
    up: (db) => {
      // SQLite 支持 ADD COLUMN（无需重建表）
      db.exec(`
          ALTER TABLE contributions ADD COLUMN attachment_name TEXT;
          ALTER TABLE contributions ADD COLUMN attachment_path TEXT;
          ALTER TABLE contributions ADD COLUMN attachment_size INTEGER;
          ALTER TABLE contributions ADD COLUMN attachment_type TEXT;
          ALTER TABLE contributions ADD COLUMN author_dept TEXT;
      `);
    },
  },
];

/** 读取当前 schema 版本 */
function currentVersion(db: DatabaseSync): number {
  try {
    const row = db
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value?: string } | undefined;
    return Number(row?.value ?? "1");
  } catch {
    return 0;
  }
}

/** 顺序执行未应用的迁移，每个迁移单独事务 */
export function runMigrations(db: DatabaseSync) {
  const current = currentVersion(db);
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    console.log(`[migrate] applying v${m.version}: ${m.name}`);
    const foreignKeys = db.prepare("PRAGMA foreign_keys").get() as {
      foreign_keys: number;
    };
    let transactionStarted = false;
    try {
      // SQLite 只能在事务外切换 foreign_keys；重建后在提交前检查关系。
      if (m.disableForeignKeys) db.exec("PRAGMA foreign_keys = OFF");
      db.exec("BEGIN IMMEDIATE");
      transactionStarted = true;
      m.up(db);
      if (m.disableForeignKeys) {
        const violations = db.prepare("PRAGMA foreign_key_check").all();
        if (violations.length > 0) {
          throw new Error(
            `Migration v${m.version} foreign key check failed: ${violations.length} violation(s)`,
          );
        }
      }
      db.prepare(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)",
      ).run(String(m.version));
      db.exec("COMMIT");
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) db.exec("ROLLBACK");
      throw error;
    } finally {
      if (m.disableForeignKeys) {
        db.exec(
          `PRAGMA foreign_keys = ${foreignKeys.foreign_keys ? "ON" : "OFF"}`,
        );
      }
    }
  }
}

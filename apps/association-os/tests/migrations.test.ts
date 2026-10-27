import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../src/lib/migrate.ts";

function createV1Database(t: TestContext, foreignKeys = 1) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec(`
    PRAGMA foreign_keys = ${foreignKeys ? "ON" : "OFF"};
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO meta VALUES ('schema_version', '1');
    CREATE TABLE departments (name TEXT PRIMARY KEY);
    INSERT INTO departments VALUES ('研发部');
    CREATE TABLE members (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, dept TEXT NOT NULL,
      role TEXT, grade TEXT NOT NULL, skills TEXT NOT NULL
    );
    INSERT INTO members VALUES ('m1', '测试成员', '研发部', NULL, '2026', '[]');
    CREATE TABLE contributions (id TEXT PRIMARY KEY);
    INSERT INTO contributions VALUES ('c1');
  `);
  return db;
}

function schemaVersion(db: DatabaseSync) {
  return db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get()
    ?.value;
}

function contributionColumns(db: DatabaseSync) {
  return db.prepare("PRAGMA table_info(contributions)").all().map(row => row.name);
}

for (const failingVersion of [2, 3]) {
  test(`v${failingVersion} 版本写入失败会回滚同次结构变更，并允许重试`, t => {
    const db = createV1Database(t);
    const originalMembers = db.prepare("SELECT * FROM members").all();
    db.exec(`
      CREATE TRIGGER block_version BEFORE INSERT ON meta
      WHEN NEW.key = 'schema_version' AND NEW.value = '${failingVersion}'
      BEGIN SELECT RAISE(ABORT, 'injected-version-write-failure'); END;
    `);

    assert.throws(() => runMigrations(db), /injected-version-write-failure/);
    assert.equal(schemaVersion(db), String(failingVersion - 1));
    assert.deepEqual(contributionColumns(db), ['id']);
    assert.equal(
      db.prepare("PRAGMA foreign_key_list(members)").all().length,
      failingVersion === 2 ? 0 : 1,
    );
    assert.deepEqual(db.prepare("SELECT * FROM members").all(), originalMembers);
    assert.equal(db.prepare("PRAGMA foreign_keys").get()?.foreign_keys, 1);

    db.exec("DROP TRIGGER block_version");
    runMigrations(db);
    assert.equal(schemaVersion(db), '3');
    assert.equal(contributionColumns(db).length, 6);
  });
}

for (const foreignKeys of [0, 1]) {
  test(`v2 拒绝孤儿关系、保留原数据并恢复外键设置 ${foreignKeys}`, t => {
    const db = createV1Database(t, foreignKeys);
    db.exec("UPDATE members SET dept = '未登记部门' WHERE id = 'm1'");
    const originalMembers = db.prepare("SELECT * FROM members").all();

    assert.throws(() => runMigrations(db), /foreign key check failed/);
    assert.equal(schemaVersion(db), '1');
    assert.deepEqual(db.prepare("SELECT * FROM members").all(), originalMembers);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_list(members)").all(), []);
    assert.equal(
      db.prepare("SELECT name FROM sqlite_schema WHERE name = 'members_new'").get(),
      undefined,
    );
    assert.equal(db.prepare("PRAGMA foreign_keys").get()?.foreign_keys, foreignKeys);

    // 测试显式补齐父记录后再重试；迁移器本身不修补或删除用户数据。
    db.exec("INSERT INTO departments VALUES ('未登记部门')");
    runMigrations(db);
    assert.equal(schemaVersion(db), '3');
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.deepEqual(db.prepare("SELECT * FROM members").all(), originalMembers);
    assert.equal(db.prepare("PRAGMA foreign_keys").get()?.foreign_keys, foreignKeys);
  });

  test(`v2 DDL 失败也恢复外键设置 ${foreignKeys}，保留已有表`, t => {
    const db = createV1Database(t, foreignKeys);
    db.exec("CREATE TABLE members_new (sentinel TEXT)");
    db.exec("INSERT INTO members_new VALUES ('keep')");

    assert.throws(() => runMigrations(db), /members_new already exists/);
    assert.equal(schemaVersion(db), '1');
    assert.equal(db.prepare("SELECT sentinel FROM members_new").get()?.sentinel, 'keep');
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM members").get()?.count, 1);
    assert.equal(db.prepare("PRAGMA foreign_keys").get()?.foreign_keys, foreignKeys);
  });

  test(`成功迁移保留外键设置 ${foreignKeys}，重复运行不修改数据或结构`, t => {
    const db = createV1Database(t, foreignKeys);
    const originalMembers = db.prepare("SELECT * FROM members").all();

    runMigrations(db);
    assert.equal(schemaVersion(db), '3');
    assert.deepEqual(contributionColumns(db), [
      'id', 'attachment_name', 'attachment_path', 'attachment_size',
      'attachment_type', 'author_dept',
    ]);
    assert.deepEqual(db.prepare("SELECT * FROM members").all(), originalMembers);
    assert.equal(db.prepare("SELECT id FROM contributions").get()?.id, 'c1');
    assert.equal(db.prepare("PRAGMA foreign_keys").get()?.foreign_keys, foreignKeys);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    const schema = db.prepare("SELECT * FROM sqlite_schema ORDER BY name").all();

    runMigrations(db);
    assert.equal(schemaVersion(db), '3');
    assert.deepEqual(db.prepare("SELECT * FROM sqlite_schema ORDER BY name").all(), schema);
    assert.deepEqual(db.prepare("SELECT * FROM members").all(), originalMembers);
    assert.equal(db.prepare("PRAGMA foreign_keys").get()?.foreign_keys, foreignKeys);
  });
}

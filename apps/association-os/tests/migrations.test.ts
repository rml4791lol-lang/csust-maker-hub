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
    CREATE TABLE projects (name TEXT PRIMARY KEY, owner TEXT NOT NULL, status TEXT NOT NULL, updated TEXT NOT NULL);
    INSERT INTO projects VALUES ('旧项目', '测试成员', '开发中', '10-28');
    CREATE TABLE items (id TEXT PRIMARY KEY);
    INSERT INTO items VALUES ('i1');
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
    assert.equal(schemaVersion(db), '5');
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
    assert.equal(schemaVersion(db), '5');
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
    assert.equal(schemaVersion(db), '5');
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
    assert.equal(schemaVersion(db), '5');
    assert.deepEqual(db.prepare("SELECT * FROM sqlite_schema ORDER BY name").all(), schema);
    assert.deepEqual(db.prepare("SELECT * FROM members").all(), originalMembers);
    assert.equal(db.prepare("PRAGMA foreign_keys").get()?.foreign_keys, foreignKeys);
  });
}

test("v4 保留原内容、生成稳定唯一 ID，旧导入仍补 ID，改名不改 ID", t => {
  const db = createV1Database(t);
  runMigrations(db);
  const project = db.prepare("SELECT * FROM projects").get()!;
  assert.match(String(project.id), /^p[0-9a-f]{32}$/);
  assert.equal(project.description, "");
  assert.equal(project.owner, "测试成员");
  db.exec("UPDATE projects SET name = '新项目' WHERE name = '旧项目'");
  assert.equal(db.prepare("SELECT id FROM projects WHERE name = '新项目'").get()?.id, project.id);
  assert.throws(() => db.prepare("UPDATE projects SET id = 'forged' WHERE id = ?").run(project.id), /immutable/);
  db.exec("INSERT INTO projects (name,owner,status,updated) VALUES ('旧导入', '负责人', '立项', '')");
  const imported = db.prepare("SELECT id FROM projects WHERE name = '旧导入'").get()!;
  assert.ok(imported.id);
  assert.notEqual(imported.id, project.id);
  assert.throws(() => db.prepare("INSERT INTO projects (name,owner,status,updated,id) VALUES ('重复', '负责人','立项','',?)").run(project.id), /UNIQUE/);
  assert.equal(db.prepare("SELECT body FROM items WHERE id='i1'").get()?.body, "");
  const rows = db.prepare("SELECT * FROM projects ORDER BY id").all();
  runMigrations(db);
  assert.deepEqual(db.prepare("SELECT * FROM projects ORDER BY id").all(), rows);
});

test("v4 版本写入失败会回滚新增列、ID 与索引，再试不丢数据", t => {
  const db = createV1Database(t);
  db.exec("CREATE TRIGGER block_v4 BEFORE INSERT ON meta WHEN NEW.key='schema_version' AND NEW.value='4' BEGIN SELECT RAISE(ABORT,'v4-failure'); END");
  assert.throws(() => runMigrations(db), /v4-failure/);
  assert.equal(schemaVersion(db), "3");
  assert.deepEqual(db.prepare("PRAGMA table_info(projects)").all().map(row => row.name), ["name", "owner", "status", "updated"]);
  assert.equal(db.prepare("SELECT name FROM projects").get()?.name, "旧项目");
  assert.equal(db.prepare("SELECT name FROM sqlite_schema WHERE name='idx_projects_id'").get(), undefined);
  db.exec("DROP TRIGGER block_v4");
  runMigrations(db);
  assert.equal(schemaVersion(db), "5");
  assert.ok(db.prepare("SELECT id FROM projects").get()?.id);
});

test("v5 默认保留纯文本，关系外键约束与删除级联正确", t => {
  const db = createV1Database(t);
  runMigrations(db);
  assert.equal(db.prepare("SELECT body_format FROM items WHERE id='i1'").get()?.body_format, "plain");
  assert.throws(() => db.exec("UPDATE items SET body_format='html'"), /CHECK/);
  db.exec("INSERT INTO media_assets VALUES ('image1','image1.png','image/png',20,2,2,'source.png','2026-10-28')");
  assert.throws(() => db.exec("INSERT INTO item_media VALUES ('i1','missing')"), /FOREIGN KEY/);
  db.exec("INSERT INTO item_media VALUES ('i1','image1')");
  assert.throws(() => db.exec("DELETE FROM media_assets"), /FOREIGN KEY/);
  db.exec("DELETE FROM items WHERE id='i1'");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM item_media").get()?.n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM media_assets").get()?.n, 1);
});

test("v5 失败回滚格式列和媒体表，重试不改变旧正文", t => {
  const db = createV1Database(t);
  db.exec("CREATE TRIGGER block_v5 BEFORE INSERT ON meta WHEN NEW.key='schema_version' AND NEW.value='5' BEGIN SELECT RAISE(ABORT,'v5-failure'); END");
  assert.throws(() => runMigrations(db), /v5-failure/);
  assert.equal(schemaVersion(db), "4");
  assert.ok(!db.prepare("PRAGMA table_info(items)").all().some(row => row.name === "body_format"));
  assert.equal(db.prepare("SELECT name FROM sqlite_schema WHERE name='media_assets'").get(), undefined);
  db.exec("UPDATE items SET body='# literal legacy text'; DROP TRIGGER block_v5");
  runMigrations(db);
  const item = db.prepare("SELECT body,body_format FROM items").get()!;
  assert.equal(item.body, "# literal legacy text");
  assert.equal(item.body_format, "plain");
  assert.equal(schemaVersion(db), "5");
});

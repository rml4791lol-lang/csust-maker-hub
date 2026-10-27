import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
import type { DepartmentRow } from "../src/lib/queries.ts";

const queriesPath = fileURLToPath(new URL("../src/lib/queries.ts", import.meta.url));
const queriesCode = ts.transpileModule(readFileSync(queriesPath, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

function createDepartmentFixture(t: TestContext) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec(`
    CREATE TABLE departments (
      name TEXT PRIMARY KEY, lead TEXT NOT NULL,
      active INTEGER NOT NULL, contributions INTEGER NOT NULL
    );
    INSERT INTO departments VALUES ('研发部', '测试负责人', 99, 88);
    INSERT INTO departments VALUES ('设计部', '另一测试负责人', 77, 66);
    CREATE TABLE members (id TEXT PRIMARY KEY, name TEXT NOT NULL, dept TEXT NOT NULL);
    CREATE TABLE contributions (
      id TEXT PRIMARY KEY, member TEXT NOT NULL, author_dept TEXT, status TEXT NOT NULL
    );
  `);

  // 执行真实查询模块，仅替换 DB 连接入口；禁止加载实际 db.ts 或其他依赖。
  const queryExports: { listDepartments?: () => DepartmentRow[] } = {};
  runInNewContext(queriesCode, {
    exports: queryExports,
    require(specifier: string) {
      assert.equal(specifier, "./db", "查询测试只允许注入内存数据库依赖");
      return { getDb: () => db };
    },
  }, { filename: queriesPath });
  assert.ok(queryExports.listDepartments);
  const listDepartments = queryExports.listDepartments;
  const department = (name: string) => {
    const result = listDepartments().find(row => row.name === name);
    assert.ok(result, `查询应包含部门 ${name}`);
    return result;
  };
  return { db, listDepartments, department };
}

test("部门人数随真实成员新增和删除变化，忽略已存储的旧计数", t => {
  const { db, department } = createDepartmentFixture(t);
  assert.equal(department("研发部").active, 0);

  db.exec("INSERT INTO members VALUES ('m1', '测试成员甲', '研发部')");
  assert.equal(department("研发部").active, 1);
  db.exec("INSERT INTO members VALUES ('m2', '测试成员乙', '研发部')");
  assert.equal(department("研发部").active, 2);
  assert.equal(department("设计部").active, 0);

  db.exec("DELETE FROM members WHERE id = 'm1'");
  assert.equal(department("研发部").active, 1);
});

test("部门足迹只累计 approved，draft 和 pending 不计入", t => {
  const { db, department } = createDepartmentFixture(t);
  db.exec(`
    INSERT INTO contributions VALUES ('c1', '测试作者', '研发部', 'approved');
    INSERT INTO contributions VALUES ('c2', '测试作者', '研发部', 'draft');
    INSERT INTO contributions VALUES ('c3', '测试作者', '研发部', 'pending');
    INSERT INTO contributions VALUES ('c4', '测试作者', '设计部', 'approved');
  `);
  assert.equal(department("研发部").contributions, 1);
  assert.equal(department("设计部").contributions, 1);

  db.exec("UPDATE contributions SET status = 'approved' WHERE id = 'c2'");
  assert.equal(department("研发部").contributions, 2);
});

test("足迹按 author_dept 精确归属，缺失部门不根据同名成员猜测", t => {
  const { db, department } = createDepartmentFixture(t);
  db.exec(`
    INSERT INTO members VALUES ('m1', '同名测试成员', '研发部');
    INSERT INTO members VALUES ('m2', '同名测试成员', '设计部');
    INSERT INTO contributions VALUES ('c1', '同名测试成员', NULL, 'approved');
    INSERT INTO contributions VALUES ('c2', '同名测试成员', '', 'approved');
    INSERT INTO contributions VALUES ('c3', '同名测试成员', '研发', 'approved');
  `);
  assert.equal(department("研发部").contributions, 0);
  assert.equal(department("设计部").contributions, 0);

  db.exec("UPDATE contributions SET author_dept = '设计部' WHERE id = 'c1'");
  assert.equal(department("研发部").contributions, 0);
  assert.equal(department("设计部").contributions, 1);
});

test("空部门仍被返回，真实人数和足迹数均为 0", t => {
  const { listDepartments } = createDepartmentFixture(t);
  const rows = listDepartments();
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.active, 0);
    assert.equal(row.contributions, 0);
    assert.ok(row.lead);
  }
});

// 隔离真实路由：源码仅经 TypeScript 转译，数据库只用 :memory:，
// 存储/审计/Next 生命周期显式注入；未知依赖直接失败，不允许打开 app.db。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);
type Context = { params: Promise<Record<string, string>> };
type Handler = (request: Request, context: Context) => Promise<Response>;
type Route = Record<"GET" | "POST" | "PATCH" | "DELETE", Handler>;
const ctx = (params: Record<string, string> = {}): Context => ({ params: Promise.resolve(params) });
const attachmentName = `${"a".repeat(32)}.pdf`;

function fixture() {
  const db = new DatabaseSync(":memory:");
  const schema = readFileSync(new URL("src/lib/db.ts", root), "utf8")
    .match(/const SCHEMA = `([\s\S]*?)`;/)?.[1];
  assert.ok(schema, "read current SCHEMA without importing disk-backed getDb");
  db.exec(schema);
  db.exec("PRAGMA foreign_keys = ON");
  const clock = { now: Date.now() };
  class TestDate extends Date {
    static now() { return clock.now; }
  }
  const calls = { reads: 0, saves: 0, audit: [] as unknown[] };
  const env: Record<string, string> = { ADMIN_USER: "fixture-admin", ADMIN_PASSWORD: "fixture-password" };
  const isolatedGlobal = {};
  const modules = new Map<string, Record<string, unknown>>();
  const injected: Record<string, unknown> = {
    "@/lib/db": { getDb: () => db },
    "@/lib/api": { ensureDynamic: async () => {}, json: (value: unknown, init?: ResponseInit) => Response.json(value, init) },
    "@/lib/audit": { writeAudit: (entry: unknown) => { calls.audit.push(entry); } },
    "@/lib/uploads": {
      MAX_SIZE: 5 * 1024 * 1024,
      saveUpload: (buffer: Buffer, name: string, type: string) => {
        calls.saves++;
        return { name, path: attachmentName, size: buffer.length, type };
      },
      readUpload: (name: string) => {
        calls.reads++;
        return name === attachmentName ? { buffer: Buffer.from("fixture attachment"), type: "application/pdf" } : null;
      },
    },
  };
  const local: Record<string, string> = {
    "@/lib/admin-auth": "src/lib/admin-auth.ts",
    "@/lib/footprint-service": "src/lib/footprint-service.ts",
    "@/lib/admin-schema": "src/lib/admin-schema.ts",
    "@/lib/workflow": "src/lib/workflow.ts",
  };
  function load(file: string): Record<string, unknown> {
    const cached = modules.get(file);
    if (cached) return cached;
    const source = readFileSync(new URL(file, root), "utf8");
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const loadedModule = { exports: {} as Record<string, unknown> };
    const resolver = (name: string): unknown => {
      if (name in injected) return injected[name];
      if (name in local) return load(local[name]);
      if (name === "node:crypto") return require(name);
      if (name === "server-only") return {};
      if (name === "jose") return require(name);
      throw new Error(`Unisolated dependency: ${name}`);
    };
    new Function("require", "module", "exports", "process", "Date", "console", "globalThis", code)(
      resolver, loadedModule, loadedModule.exports, { env }, TestDate,
      { log: () => {}, error: () => {} }, isolatedGlobal,
    );
    modules.set(file, loadedModule.exports);
    return loadedModule.exports;
  }
  (load("src/lib/migrate.ts") as { runMigrations: (db: DatabaseSync) => void }).runMigrations(db);
  function seedContribution(id: string, status: string, path: string | null = null) {
    db.prepare(
      `INSERT INTO contributions (id,member,date,content,hours,status,created_at,attachment_path)
       VALUES (?, 'fixture', '10-27', 'fixture content', 1, ?, '2026-10-27T00:00:00Z', ?)`,
    ).run(id, status, path);
  }
  function seedMember(id = "m01") {
    db.prepare("INSERT OR IGNORE INTO departments VALUES ('技术部', 'fixture', 0, 0)").run();
    db.prepare("INSERT INTO members (id,name,dept,role,grade,skills) VALUES (?, 'fixture', '技术部', '', '2024', '[]')").run(id);
  }
  return {
    db, calls, clock, env, seedContribution, seedMember,
    route: (path: string) => load(`src/app/api/${path}/route.ts`) as Route,
    reloadModules: () => modules.clear(),
    close: () => db.close(),
  };
}

function jsonRequest(body: unknown, headers: HeadersInit = {}) {
  return new Request("http://fixture/api/contributions", {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
  });
}

function formRequest(values: Record<string, string | Blob>, headers: HeadersInit = {}) {
  const body = new FormData();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return new Request("http://fixture/api/footprints", { method: "POST", body, headers });
}

test("两个公开列表一致且只返回公开足迹", async () => {
  const f = fixture();
  try {
    f.seedContribution("draft", "draft");
    f.seedContribution("pending", "pending");
    f.seedContribution("public", "approved");
    for (const path of ["contributions", "footprints"]) {
      const response = await f.route(path).GET(new Request("http://fixture"), ctx());
      const rows = await response.json();
      assert.deepEqual(rows.map((row: { id: string }) => row.id), ["public"]);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  } finally { f.close(); }
});

test("两种提交格式均立即公开，同毫秒 ID 不碰撞，附件关联正常", async () => {
  const f = fixture();
  try {
    const first = await f.route("contributions").POST(jsonRequest({ member: "fixture", content: "JSON", hours: 2 }), ctx());
    const second = await f.route("footprints").POST(formRequest({
      member: "fixture", content: "multipart", hours: "1.5", date: "02-29",
      file: new Blob(["fixture attachment"], { type: "application/pdf" }),
    }), ctx());
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    const a = await first.json();
    const b = await second.json();
    assert.notEqual(a.id, b.id);
    assert.equal(a.status, "approved");
    assert.equal(b.status, "approved");
    const rows = f.db.prepare("SELECT status, attachment_path FROM contributions").all();
    assert.equal(rows.length, 2);
    assert.ok(rows.every(row => row.status === "approved"));
    assert.equal(rows[1].attachment_path, attachmentName);
    assert.equal(f.calls.saves, 1);
    assert.equal(f.calls.audit.length, 2);
  } finally { f.close(); }
});

test("旧 JSON 入口拒绝无效对象、长度、类型和工时；不写入数据库", async () => {
  const invalid = [null, [], "text", { member: {}, content: "test" },
    { member: " ", content: "test" }, { member: "m".repeat(21), content: "test" },
    { member: "test", content: "c".repeat(501) },
    ...[-1, 25, "Infinity", "NaN", {}, true].map(hours => ({ member: "test", content: "test", hours })),
    { member: "test", content: "test", date: "02-30" }];
  for (const body of invalid) {
    const f = fixture();
    try {
      assert.equal((await f.route("contributions").POST(jsonRequest(body), ctx())).status, 400, JSON.stringify(body));
      assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM contributions").get()?.n, 0);
    } finally { f.close(); }
  }
});

test("multipart 使用相同校验，超大附件不会进入存储", async () => {
  const invalid: Array<Record<string, string | Blob>> = [
    { member: "m".repeat(21), content: "test" },
    { member: "test", content: "c".repeat(501) },
    { member: "test", content: "test", hours: "-1" },
    { member: new Blob(["not a name"]), content: "test" },
    { member: "test", content: "test", file: new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "application/pdf" }) },
  ];
  for (const body of invalid) {
    const f = fixture();
    try {
      assert.equal((await f.route("footprints").POST(formRequest(body), ctx())).status, 400);
      assert.equal(f.calls.saves, 0);
      assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM contributions").get()?.n, 0);
    } finally { f.close(); }
  }
});

test("两个入口共享配额，并在窗口到期后恢复", async () => {
  const f = fixture();
  try {
    for (let i = 0; i < 10; i++) {
      // 模拟不同 Route bundle 各自加载 service，进程额度仍须共享。
      f.reloadModules();
      const response = i % 2
        ? await f.route("footprints").POST(formRequest({ member: "fixture", content: String(i) }), ctx())
        : await f.route("contributions").POST(jsonRequest({ member: "fixture", content: String(i) }), ctx());
      assert.equal(response.status, 201);
    }
    const blocked = await f.route("contributions").POST(jsonRequest({ member: "fixture", content: "blocked" }), ctx());
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get("retry-after"), "3600");
    f.clock.now += 60 * 60 * 1000;
    assert.equal((await f.route("footprints").POST(formRequest({ member: "fixture", content: "new window" }), ctx())).status, 201);
  } finally { f.close(); }
});

test("附件只向公众开放已公开关联记录，管理员可读未公开附件，删除后拒绝访问", async () => {
  const f = fixture();
  try {
    f.seedContribution("attachment", "draft", attachmentName);
    const route = f.route("uploads/[name]");
    const get = (authorization?: string) => route.GET(new Request("http://fixture", {
      headers: authorization ? { authorization } : {},
    }), ctx({ name: attachmentName }));
    assert.equal((await get()).status, 404);
    assert.equal((await get("Basic malformed")).status, 404);
    assert.equal((await get(`Basic ${btoa("fixture-admin:wrong")}`)).status, 404);
    assert.equal(f.calls.reads, 0, "unauthorized request must not read storage");
    const auth = `Basic ${btoa("fixture-admin:fixture-password")}`;
    const admin = await get(auth);
    assert.equal(admin.status, 200);
    assert.equal(admin.headers.get("cache-control"), "private, no-store");
    delete f.env.ADMIN_PASSWORD;
    assert.equal((await get(auth)).status, 404);
    f.env.ADMIN_PASSWORD = "fixture-password";
    f.db.prepare("UPDATE contributions SET status = 'approved' WHERE id = 'attachment'").run();
    const publicFile = await get();
    assert.equal(publicFile.status, 200);
    assert.equal(publicFile.headers.get("cache-control"), "private, no-store");
    assert.equal(publicFile.headers.get("x-content-type-options"), "nosniff");
    await f.route("admin/[table]/[id]").DELETE(new Request("http://fixture"), ctx({ table: "contributions", id: "attachment" }));
    assert.equal((await get()).status, 404);
    assert.equal((await get(auth)).status, 404);
  } finally { f.close(); }
});

test("有外键数据时清空成功，失败时完整回滚", async () => {
  for (const fail of [false, true]) {
    const f = fixture();
    try {
      f.seedMember();
      f.seedContribution("public", "approved");
      if (fail) {
        f.db.exec("CREATE TRIGGER reject_clear BEFORE DELETE ON contributions BEGIN SELECT RAISE(ABORT, 'fixture failure'); END");
      }
      const response = await f.route("admin/clear-data").POST(jsonRequest({ confirm: "CLEAR" }), ctx());
      assert.equal(response.status, fail ? 500 : 200);
      for (const table of ["members", "departments", "contributions"]) {
        assert.equal(f.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n, fail ? 1 : 0);
      }
      assert.equal(f.db.prepare("SELECT value FROM meta WHERE key='data_source'").get()?.value, fail ? undefined : "cleared");
      assert.equal(f.calls.audit.length, fail ? 0 : 1);
      assert.deepEqual(f.db.prepare("PRAGMA foreign_key_check").all(), []);
    } finally { f.close(); }
  }
});

test("管理员新增成员跨越 m99/m100 边界后仍正常生成唯一 ID", async () => {
  const f = fixture();
  try {
    for (let i = 1; i <= 100; i++) f.seedMember(`m${String(i).padStart(2, "0")}`);
    const route = f.route("admin/[table]");
    const ids = new Set<string>();
    for (let i = 0; i < 2; i++) {
      const response = await route.POST(jsonRequest({ name: "fixture", dept: "技术部", grade: "2024", skills: [] }), ctx({ table: "members" }));
      assert.equal(response.status, 201);
      ids.add((await response.json()).id);
    }
    assert.equal(ids.size, 2);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM members").get()?.n, 102);
  } finally { f.close(); }
});

test("管理写入与清空对 null/数组返回 400，不抛出异常", async () => {
  const f = fixture();
  try {
    f.seedMember();
    for (const body of [null, []]) {
      assert.equal((await f.route("admin/[table]").POST(jsonRequest(body), ctx({ table: "members" }))).status, 400);
      assert.equal((await f.route("admin/[table]/[id]").PATCH(jsonRequest(body), ctx({ table: "members", id: "m01" }))).status, 400);
      assert.equal((await f.route("admin/clear-data").POST(jsonRequest(body), ctx())).status, 400);
    }
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM members").get()?.n, 1);
  } finally { f.close(); }
});

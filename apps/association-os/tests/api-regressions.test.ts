// 隔离真实路由：源码仅经 TypeScript 转译，数据库只用 :memory:，
// 存储/审计/Next 生命周期显式注入；未知依赖直接失败，不允许打开 app.db。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);
type Context = { params: Promise<Record<string, string>> };
type Handler = (request: Request, context: Context) => Promise<Response>;
type Route = Record<"GET" | "POST" | "PATCH" | "DELETE", Handler>;
const ctx = (params: Record<string, string> = {}): Context => ({ params: Promise.resolve(params) });
const attachmentName = `${"a".repeat(32)}.pdf`;

function fixture() {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), "association-api-test-"));
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
  const env: Record<string, string> = { ADMIN_USER: "fixture-admin", ADMIN_PASSWORD: "fixture-password", AI_ASSOCIATION_DATA_DIR: dataDirectory };
  const isolatedGlobal = {};
  const modules = new Map<string, Record<string, unknown>>();
  const injected: Record<string, unknown> = {
    "mdast-util-from-markdown": { fromMarkdown },
    "mdast-util-gfm": { gfmFromMarkdown },
    "micromark-extension-gfm": { gfm },
    "@/lib/db": { getDb: () => db },
    "./db": { getDb: () => db },
    "@/lib/api": { ensureDynamic: async () => {}, json: (value: unknown, init?: ResponseInit) => Response.json(value, init) },
    "@/lib/audit": { writeAudit: (entry: unknown) => { calls.audit.push(entry); } },
    "@/lib/admin-account": {
      usesEnvironmentAccount: () => Boolean(env.ADMIN_USER || env.ADMIN_PASSWORD),
      readLocalAccount: () => null,
      verifyLocalAccount: async () => false,
    },
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
    "@/lib/public-records": "src/lib/public-records.ts",
    "@/lib/article-media": "src/lib/article-media.ts",
    "@/lib/media-storage": "src/lib/media-storage.ts",
  };
  function load(file: string): Record<string, unknown> {
    const cached = modules.get(file);
    if (cached) return cached;
    const source = readFileSync(new URL(file, root), "utf8");
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const loadedModule = { exports: {} as Record<string, unknown> };
    const resolver = (name: string): unknown => {
      if (name in injected) return injected[name];
      if (name in local) return load(local[name]);
      if (["node:crypto", "node:fs/promises", "node:path", "sharp"].includes(name)) return require(name);
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
    db, calls, clock, env, seedContribution, seedMember, dataDirectory,
    publicRecords: () => load("src/lib/public-records.ts") as { getPublicRecord: (module: string, id: string) => Record<string, unknown> | null },
    route: (path: string) => load(`src/app/api/${path}/route.ts`) as Route,
    reloadModules: () => modules.clear(),
    close: () => { db.close(); rmSync(dataDirectory, { recursive: true, force: true }); },
  };
}

function jsonRequest(body: unknown, headers: HeadersInit = {}) {
  return new Request("http://fixture/api/contributions", {
    method: "POST", headers: { "Content-Type": "application/json", authorization: `Basic ${btoa("fixture-admin:fixture-password")}`, ...headers }, body: JSON.stringify(body),
  });
}

function formRequest(values: Record<string, string | Blob>, headers: HeadersInit = {}) {
  const body = new FormData();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return new Request("http://fixture/api/footprints", { method: "POST", body, headers: { authorization: `Basic ${btoa("fixture-admin:fixture-password")}`, ...headers } });
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

test("匿名与跨站足迹写入在读取附件和数据写入之前被拒绝", async () => {
  const f = fixture();
  try {
    for (const path of ["contributions", "footprints"]) {
      const anonymous = path === "contributions"
        ? jsonRequest({ member: "fixture", content: "blocked" }, { authorization: "" })
        : formRequest({ member: "fixture", content: "blocked", file: new Blob(["fixture"]) }, { authorization: "" });
      assert.equal((await f.route(path).POST(anonymous, ctx())).status, 401);
      const crossSite = path === "contributions"
        ? jsonRequest({ member: "fixture", content: "blocked" }, { origin: "https://foreign.test" })
        : formRequest({ member: "fixture", content: "blocked" }, { origin: "https://foreign.test" });
      assert.equal((await f.route(path).POST(crossSite, ctx())).status, 403);
    }
    assert.equal(f.calls.saves, 0);
    assert.equal(f.calls.audit.length, 0);
    assert.equal(f.db.prepare("SELECT count(*) AS n FROM contributions").get()?.n, 0);
  } finally { f.close(); }
});

test("管理员两种提交格式均立即公开，同毫秒 ID 不碰撞，附件关联正常", async () => {
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
    await f.route("admin/[table]/[id]").DELETE(jsonRequest({}), ctx({ table: "contributions", id: "attachment" }));
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

test("项目使用稳定 ID 完成新增、读取、改名，旧 name API 兼容并同步足迹文本关联", async () => {
  const f = fixture();
  try {
    const route = f.route("admin/[table]");
    const single = f.route("admin/[table]/[id]");
    const created = await route.POST(jsonRequest({ name: "旧项目", owner: "负责人", status: "立项", description: "真实说明" }), ctx({ table: "projects" }));
    assert.equal(created.status, 201);
    const row = await created.json();
    assert.match(row.id, /^p/);
    f.seedContribution("related", "approved");
    f.db.prepare("UPDATE contributions SET project = '旧项目' WHERE id='related'").run();
    assert.equal((await single.GET(new Request("http://fixture"), ctx({ table: "projects", id: row.id }))).status, 401);
    const oldRead = await single.GET(jsonRequest({}), ctx({ table: "projects", id: "旧项目" }));
    assert.equal(oldRead.status, 200);
    const changed = await single.PATCH(jsonRequest({ name: "新项目", id: "forged", description: "新的说明" }), ctx({ table: "projects", id: row.id }));
    assert.equal(changed.status, 200);
    assert.equal((await changed.json()).id, row.id);
    assert.equal(f.db.prepare("SELECT project FROM contributions WHERE id='related'").get()?.project, "新项目");
    const publicRow = f.publicRecords().getPublicRecord("projects", row.id)!;
    assert.equal(publicRow.name, "新项目");
    assert.equal(publicRow.description, "新的说明");
    assert.equal(publicRow.id, row.id);
    assert.equal(f.publicRecords().getPublicRecord("projects", "新项目"), null);
    assert.equal((await single.GET(jsonRequest({}), ctx({ table: "projects", id: row.id }))).status, 200);
    assert.equal((await single.DELETE(jsonRequest({}), ctx({ table: "projects", id: row.id }))).status, 200);
    assert.equal(f.publicRecords().getPublicRecord("projects", row.id), null);
  } finally { f.close(); }
});

test("项目改名关联更新失败时一并回滚项目及说明", async () => {
  const f = fixture();
  try {
    f.db.exec("INSERT INTO projects (name,owner,status,updated) VALUES ('旧项目','负责人','立项','')");
    const id = String(f.db.prepare("SELECT id FROM projects").get()?.id);
    f.seedContribution("related", "approved");
    f.db.exec("UPDATE contributions SET project='旧项目'; CREATE TRIGGER reject_rename BEFORE UPDATE OF project ON contributions BEGIN SELECT RAISE(ABORT,'fixture'); END");
    const response = await f.route("admin/[table]/[id]").PATCH(jsonRequest({ name: "新项目", description: "不应保存" }), ctx({ table: "projects", id }));
    assert.equal(response.status, 400);
    assert.equal(f.db.prepare("SELECT name FROM projects").get()?.name, "旧项目");
    assert.equal(f.db.prepare("SELECT description FROM projects").get()?.description, "");
    assert.equal(f.db.prepare("SELECT project FROM contributions").get()?.project, "旧项目");
  } finally { f.close(); }
});

test("公开内容列表与详情使用相同白名单，不泄漏草稿和未知状态，正文与来源可编辑", async () => {
  const f = fixture();
  try {
    const statuses = ["草稿", "待审核", "未知", "已发布", "已收录", "报名中", "已归档"];
    for (const [i, status] of statuses.entries()) {
      f.db.prepare("INSERT INTO items (id,title,type,topic,author,summary,tags,status,updated,body,source_url) VALUES (?,?,'guide','ai','作者','摘要','[]',?,'10-28','正文','https://example.org/source')").run(`i${i}`, `标题${i}`, status);
    }
    const route = f.route("items");
    const list = await (await route.GET(new Request("http://fixture/api/items?q=标题&type=guide&topic=ai"), ctx())).json();
    assert.equal(list.length, 4);
    assert.ok(list.every((row: Record<string, unknown>) => !("body" in row)));
    for (const [i] of statuses.entries()) {
      const record = f.publicRecords().getPublicRecord("library", `i${i}`);
      assert.equal(record !== null, i >= 3);
      if (record) assert.equal(record.body, "正文");
    }
    const write = await f.route("admin/[table]/[id]").PATCH(jsonRequest({ body: "更新的多行\n内容", source_url: "https://example.org/new" }), ctx({ table: "items", id: "i3" }));
    assert.equal(write.status, 200);
    assert.equal(f.publicRecords().getPublicRecord("library", "i3")?.source_url, "https://example.org/new");
    for (const url of ["javascript:alert(1)", "data:text/html,x", "file:///tmp/a", "https://u:p@example.org", "invalid"]) {
      const bad = await f.route("admin/[table]/[id]").PATCH(jsonRequest({ source_url: url }), ctx({ table: "items", id: "i3" }));
      assert.equal(bad.status, 400, url);
    }
    f.db.exec("UPDATE items SET source_url='javascript:alert(1)' WHERE id='i3'");
    assert.equal(f.publicRecords().getPublicRecord("library", "i3")?.source_url, "");
    await f.route("admin/[table]/[id]").PATCH(jsonRequest({ status: "草稿" }), ctx({ table: "items", id: "i3" }));
    assert.equal(f.publicRecords().getPublicRecord("library", "i3"), null);
    assert.equal((await (await route.GET(new Request("http://fixture/api/items"), ctx())).json()).length, 3);
  } finally { f.close(); }
});

function imageRequest(bytes: Uint8Array, mime = "image/png", headers: HeadersInit = {}) {
  return new Request("http://fixture/api/admin/media?name=fixture.png", {
    method: "POST", body: new Uint8Array(bytes),
    headers: { "Content-Type": mime, authorization: `Basic ${btoa("fixture-admin:fixture-password")}`, ...headers },
  });
}

async function pngFixture(width = 12, height = 8) {
  return sharp({ create: { width, height, channels: 3, background: { r: 25, g: 70, b: 120 } } }).png().toBuffer();
}

const articleInput = (body: string, status = "草稿") => ({
  title: "测试图文", author: "测试作者", type: "guide", topic: "ai", summary: "隔离测试摘要",
  body, body_format: "markdown", status,
});

test("媒体与清空路由自身先拒绝匿名/跨站，不读取正文或触碰存储", async () => {
  const f = fixture();
  try {
    for (const [headers, status] of [[{ authorization: "" }, 401], [{ origin: "https://foreign.test" }, 403]] as const) {
      const upload = imageRequest(new Uint8Array([1]), "image/png", headers);
      assert.equal((await f.route("admin/media").POST(upload, ctx())).status, status);
      assert.equal(upload.bodyUsed, false);
      const clear = jsonRequest({ confirm: "CLEAR" }, headers);
      assert.equal((await f.route("admin/clear-data").POST(clear, ctx())).status, status);
      assert.equal(clear.bodyUsed, false);
    }
    assert.deepEqual(readdirSync(f.dataDirectory), []);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM media_assets").get()?.n, 0);
    assert.equal(f.calls.audit.length, 0);
  } finally { f.close(); }
});

test("图片真实解码重编码，隔离目录落盘，未绑定仅管理员可读", async () => {
  const f = fixture();
  try {
    const png = await pngFixture();
    const payload = Buffer.concat([png, Buffer.from("TRAILING-PRIVATE-CONTENT")]);
    const upload = await f.route("admin/media").POST(imageRequest(payload), ctx());
    assert.equal(upload.status, 201);
    const asset = await upload.json();
    assert.match(asset.id, /^[0-9a-f]{32}$/);
    assert.equal(asset.url, `/api/media/${asset.id}`);
    assert.equal(asset.width, 12);
    assert.equal(asset.height, 8);
    const stored = f.db.prepare("SELECT * FROM media_assets WHERE id=?").get(asset.id)!;
    const disk = readFileSync(path.join(f.dataDirectory, "media", String(stored.storage_name)));
    assert.equal(disk.includes(Buffer.from("TRAILING-PRIVATE-CONTENT")), false);
    assert.equal((await sharp(disk).metadata()).format, "png");
    const get = f.route("media/[id]");
    assert.equal((await get.GET(new Request("http://fixture"), ctx({ id: asset.id }))).status, 404);
    const admin = await get.GET(jsonRequest({}), ctx({ id: asset.id }));
    assert.equal(admin.status, 200);
    assert.equal(admin.headers.get("cache-control"), "private, no-store");
    assert.equal(admin.headers.get("vary"), "Cookie, Authorization");
    assert.equal(admin.headers.get("x-content-type-options"), "nosniff");
    assert.equal(admin.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await admin.arrayBuffer()), disk);
    assert.equal((await get.GET(jsonRequest({}), ctx({ id: "../app.db" }))).status, 404);
  } finally { f.close(); }
});

test("拒绝伪签名/MIME不符/截断/SVG/动态PNG/尺寸与流大小超限", async () => {
  const f = fixture();
  try {
    const png = await pngFixture();
    const apngMarker = Buffer.alloc(20);
    apngMarker.writeUInt32BE(8);
    apngMarker.write("acTL", 4);
    apngMarker.writeUInt32BE(2, 8);
    const animated = Buffer.concat([png.subarray(0, 33), apngMarker, png.subarray(33)]);
    const candidates: [Uint8Array, string, number][] = [
      [Buffer.from("not a PNG"), "image/png", 400],
      [png, "image/jpeg", 400],
      [png.subarray(0, 40), "image/png", 400],
      [Buffer.from("<svg></svg>"), "image/svg+xml", 400],
      [animated, "image/png", 400],
      [await pngFixture(8193, 1), "image/png", 413],
      [await pngFixture(5000, 4001), "image/png", 413],
      [Buffer.alloc(5 * 1024 * 1024 + 1), "image/png", 413],
    ];
    for (const [bytes, mime, status] of candidates) {
      assert.equal((await f.route("admin/media").POST(imageRequest(bytes, mime), ctx())).status, status);
    }
    const declared = imageRequest(png, "image/png", { "content-length": String(5 * 1024 * 1024 + 1) });
    assert.equal((await f.route("admin/media").POST(declared, ctx())).status, 413);
    assert.equal(declared.bodyUsed, false);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM media_assets").get()?.n, 0);
    assert.deepEqual(readdirSync(f.dataDirectory), []);
  } finally { f.close(); }
});

test("图片上传数据库失败只补偿本次文件，保留已有资产", async () => {
  const f = fixture();
  try {
    const png = await pngFixture();
    assert.equal((await f.route("admin/media").POST(imageRequest(png), ctx())).status, 201);
    const originals = readdirSync(path.join(f.dataDirectory, "media"));
    f.db.exec("CREATE TRIGGER reject_media BEFORE INSERT ON media_assets BEGIN SELECT RAISE(ABORT,'fixture'); END");
    assert.equal((await f.route("admin/media").POST(imageRequest(png), ctx())).status, 500);
    assert.deepEqual(readdirSync(path.join(f.dataDirectory, "media")), originals);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM media_assets").get()?.n, 1);
  } finally { f.close(); }
});

test("JPEG与WebP可用，EXIF方向应用后移除元数据", async () => {
  const f = fixture();
  try {
    const png = await pngFixture();
    const jpeg = await sharp(png).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const webp = await sharp(png).webp().toBuffer();
    for (const [bytes, mime, width, height] of [[jpeg, "image/jpeg", 8, 12], [webp, "image/webp", 12, 8]] as const) {
      const response = await f.route("admin/media").POST(imageRequest(bytes, mime), ctx());
      assert.equal(response.status, 201);
      const asset = await response.json();
      assert.equal(asset.mime, mime);
      assert.equal(asset.width, width);
      assert.equal(asset.height, height);
      const row = f.db.prepare("SELECT storage_name FROM media_assets WHERE id=?").get(asset.id)!;
      const result = await sharp(readFileSync(path.join(f.dataDirectory, "media", String(row.storage_name)))).metadata();
      assert.equal(result.exif, undefined);
      assert.equal(result.orientation, undefined);
    }
  } finally { f.close(); }
});

test("媒体限流无法用伪造IP重置，时间窗后恢复", async () => {
  const f = fixture();
  try {
    for (let i = 0; i < 30; i++) {
      const response = await f.route("admin/media").POST(imageRequest(new Uint8Array([1]), "image/png", { "x-forwarded-for": `203.0.113.${i}` }), ctx());
      assert.equal(response.status, 400);
    }
    const next = imageRequest(new Uint8Array([1]));
    const response = await f.route("admin/media").POST(next, ctx());
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "60");
    assert.equal(next.bodyUsed, false);
    f.clock.now += 60_000;
    assert.equal((await f.route("admin/media").POST(imageRequest(new Uint8Array([1])), ctx())).status, 400);
  } finally { f.close(); }
});

test("文章图片引用随草稿/发布/共享/移除/删除即时收回匿名权限", async () => {
  const f = fixture();
  try {
    const asset = await (await f.route("admin/media").POST(imageRequest(await pngFixture()), ctx())).json();
    const list = f.route("admin/[table]");
    const single = f.route("admin/[table]/[id]");
    const get = () => f.route("media/[id]").GET(new Request("http://fixture"), ctx({ id: asset.id }));
    const response = await list.POST(jsonRequest(articleInput(`文字\n\n![替代文本](${asset.url} "图注")`)), ctx({ table: "items" }));
    assert.equal(response.status, 201);
    const item = await response.json();
    const itemCtx = ctx({ table: "items", id: item.id });
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM item_media").get()?.n, 1);
    assert.equal((await get()).status, 404);
    assert.equal((await single.PATCH(jsonRequest({ status: "已发布" }), itemCtx)).status, 200);
    assert.equal((await get()).status, 200);
    const share = await list.POST(jsonRequest(articleInput(`![共用](${asset.url})`, "已发布")), ctx({ table: "items" }));
    assert.equal(share.status, 201);
    const shared = await share.json();
    await single.PATCH(jsonRequest({ status: "草稿" }), itemCtx);
    assert.equal((await get()).status, 200, "another public article still references it");
    await single.DELETE(jsonRequest({}), ctx({ table: "items", id: shared.id }));
    assert.equal((await get()).status, 404);
    await single.PATCH(jsonRequest({ status: "已发布" }), itemCtx);
    assert.equal((await get()).status, 200);
    await single.PATCH(jsonRequest({ body: "已移除图片" }), itemCtx);
    assert.equal((await get()).status, 404);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM item_media").get()?.n, 0);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM media_assets").get()?.n, 1);
    assert.equal(readdirSync(path.join(f.dataDirectory, "media")).length, 1);
  } finally { f.close(); }
});

test("Markdown实际AST绑定，代码不绑定，旧plain原样，非法图片/HTML/链接不落库", async () => {
  const f = fixture();
  try {
    const asset = await (await f.route("admin/media").POST(imageRequest(await pngFixture()), ctx())).json();
    const list = f.route("admin/[table]");
    const create = (body: string) => list.POST(jsonRequest(articleInput(body)), ctx({ table: "items" }));
    const code = await create(`\`![code](${asset.url})\`\n\n\`\`\`md\n![code](${asset.url})\n\`\`\``);
    assert.equal(code.status, 201);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM item_media").get()?.n, 0);
    const reference = await create(`![first][image]\n\n![second][image]\n\n[image]: ${asset.url} "Caption"`);
    assert.equal(reference.status, 201);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM item_media").get()?.n, 1);
    const legacy = await list.POST(jsonRequest({ ...articleInput("# text <script>literal</script> ![external](https://example.org/a.png)"), body_format: "plain" }), ctx({ table: "items" }));
    assert.equal(legacy.status, 201);
    const old = await legacy.json();
    assert.equal(old.body_format, "plain");
    assert.ok(old.body.includes("<script>literal</script>"));
    const before = f.db.prepare("SELECT COUNT(*) AS n FROM items").get()?.n;
    for (const body of [
      "![remote](https://example.org/a.png)", "![data](data:image/png;base64,xxx)",
      `![missing](/api/media/${"f".repeat(32)})`, "<img src=x onerror=alert(1)>",
      "[bad](javascript:alert%281%29)", "[bad](file:///etc/passwd)", "[bad](https://u:p@example.org)",
      "![reference][foo]\n\n[foo]: https://example.org/image.png",
    ]) assert.equal((await create(body)).status, 400, body);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM items").get()?.n, before);
    assert.equal((await create("[来源](https://example.org/source)\n\n> 引用\n\n- 列表")).status, 201);
  } finally { f.close(); }
});

test("正文与关系绑定失败一起回滚，格式切回plain移除图片公开权限", async () => {
  const f = fixture();
  try {
    const asset = await (await f.route("admin/media").POST(imageRequest(await pngFixture()), ctx())).json();
    const created = await f.route("admin/[table]").POST(jsonRequest(articleInput(`![图](${asset.url})`, "已发布")), ctx({ table: "items" }));
    const item = await created.json();
    const single = f.route("admin/[table]/[id]");
    const itemCtx = ctx({ table: "items", id: item.id });
    f.db.exec("CREATE TRIGGER reject_binding BEFORE DELETE ON item_media BEGIN SELECT RAISE(ABORT,'fixture'); END");
    assert.equal((await single.PATCH(jsonRequest({ body: "change", title: "应回滚", status: "草稿" }), itemCtx)).status, 400);
    const current = f.db.prepare("SELECT * FROM items WHERE id=?").get(item.id)!;
    assert.equal(current.title, "测试图文");
    assert.equal(current.status, "已发布");
    assert.equal(current.body, item.body);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM item_media").get()?.n, 1);
    f.db.exec("DROP TRIGGER reject_binding");
    assert.equal((await single.PATCH(jsonRequest({ body_format: "plain" }), itemCtx)).status, 200);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM item_media").get()?.n, 0);
    assert.equal((await f.route("media/[id]").GET(new Request("http://fixture"), ctx({ id: asset.id }))).status, 404);
  } finally { f.close(); }
});

test("GFM脚注与表格按阅读器同一语法校验，脚注图片正常绑定且不能藏外链/HTML", async () => {
  const f = fixture();
  try {
    const asset = await (await f.route("admin/media").POST(imageRequest(await pngFixture()), ctx())).json();
    const list = f.route("admin/[table]");
    const create = (body: string) => list.POST(jsonRequest(articleInput(body, "已发布")), ctx({ table: "items" }));
    const footnote = await create(`正文[^图]\n\n[^图]: ![说明](${asset.url})`);
    assert.equal(footnote.status, 201);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM item_media").get()?.n, 1);
    assert.equal((await f.route("media/[id]").GET(new Request("http://fixture"), ctx({ id: asset.id }))).status, 200);
    const table = await create(`| 图片 |\n| --- |\n| ~~![表格图](${asset.url})~~ |`);
    assert.equal(table.status, 201);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM item_media").get()?.n, 2);
    const before = f.db.prepare("SELECT COUNT(*) AS n FROM items").get()?.n;
    for (const reference of ["正文[^n]", "正文未引用脚注"]) {
      for (const hidden of ["![外图](https://example.org/a.png)", "<img src=x onerror=alert(1)>", "[坏链接](javascript:alert%281%29)"]) {
        assert.equal((await create(`${reference}\n\n[^n]: ${hidden}`)).status, 400);
      }
    }
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM items").get()?.n, before);
    assert.equal((await create("| 来源 |\n| --- |\n| https://example.org |\n\n- [x] 已完成")).status, 201);
  } finally { f.close(); }
});

test("清空业务数据会级联移除媒体关系并收回匿名访问，媒体本体保留私有", async () => {
  const f = fixture();
  try {
    const asset = await (await f.route("admin/media").POST(imageRequest(await pngFixture()), ctx())).json();
    await f.route("admin/[table]").POST(jsonRequest(articleInput(`![图](${asset.url})`, "已发布")), ctx({ table: "items" }));
    const get = f.route("media/[id]");
    assert.equal((await get.GET(new Request("http://fixture"), ctx({ id: asset.id }))).status, 200);
    assert.equal((await f.route("admin/clear-data").POST(jsonRequest({ confirm: "CLEAR" }), ctx())).status, 200);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM item_media").get()?.n, 0);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM media_assets").get()?.n, 1);
    assert.equal(readdirSync(path.join(f.dataDirectory, "media")).length, 1);
    assert.equal((await get.GET(new Request("http://fixture"), ctx({ id: asset.id }))).status, 404);
    assert.equal((await get.GET(jsonRequest({}), ctx({ id: asset.id }))).status, 200);
  } finally { f.close(); }
});

test("公开足迹详情仅 approved，保留附件投影且不扩展为任意数据表读取", () => {
  const f = fixture();
  try {
    for (const status of ["draft", "pending", "approved"]) f.seedContribution(status, status, attachmentName);
    const records = f.publicRecords();
    assert.equal(records.getPublicRecord("footprints", "draft"), null);
    assert.equal(records.getPublicRecord("footprints", "pending"), null);
    assert.equal(records.getPublicRecord("footprints", "approved")?.attachment_path, attachmentName);
    assert.equal(records.getPublicRecord("audit_log", "1"), null);
    assert.equal(records.getPublicRecord("__proto__", "1"), null);
    assert.equal(records.getPublicRecord("library", "' OR 1=1 --"), null);
  } finally { f.close(); }
});

test("管理 API 自身拒绝匿名与跨站请求，字段格式与活动容量校验不改变数据", async () => {
  const f = fixture();
  try {
    f.seedMember();
    const list = f.route("admin/[table]");
    const single = f.route("admin/[table]/[id]");
    assert.equal((await list.GET(new Request("http://fixture"), ctx({ table: "members" }))).status, 401);
    assert.equal((await list.POST(jsonRequest({ name: "blocked" }, { authorization: "" }), ctx({ table: "members" }))).status, 401);
    assert.equal((await single.PATCH(jsonRequest({ name: "blocked" }, { origin: "https://foreign.test" }), ctx({ table: "members", id: "m01" }))).status, 403);
    assert.equal((await single.DELETE(new Request("http://fixture"), ctx({ table: "members", id: "m01" }))).status, 401);
    for (const body of [{ name: " " }, { name: {} }, { skills: [{}] }, { skills: ["x".repeat(101)] }]) {
      assert.equal((await single.PATCH(jsonRequest(body), ctx({ table: "members", id: "m01" }))).status, 400);
    }
    assert.equal((await list.POST(jsonRequest({ title: "测试活动", kind: "meeting", joined: 5, capacity: 3 }), ctx({ table: "activities" }))).status, 400);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM activities").get()?.n, 0);
    assert.equal(f.db.prepare("SELECT name FROM members WHERE id='m01'").get()?.name, "fixture");
    assert.equal((await list.GET(jsonRequest({}), ctx({ table: "__proto__" }))).status, 404);
  } finally { f.close(); }
});

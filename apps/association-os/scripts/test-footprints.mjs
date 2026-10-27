// 测试足迹：公开提交（无文件 + 带文件）+ 公开读取
const BASE = "http://localhost:3000";

async function main() {
  // 1. 无文件提交
  const fd1 = new FormData();
  fd1.set("member", "测试同学");
  fd1.set("content", "今天把足迹功能做出来了，可以描述做了什么，文件可选");
  const r1 = await fetch(`${BASE}/api/footprints`, { method: "POST", body: fd1 });
  console.log("无文件提交:", r1.status, await r1.text());

  // 2. 带文件提交（1x1 PNG）
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const fd2 = new FormData();
  fd2.set("member", "测试同学");
  fd2.set("content", "带一张图测试附件上传");
  fd2.set("file", new Blob([png], { type: "image/png" }), "test.png");
  const r2 = await fetch(`${BASE}/api/footprints`, { method: "POST", body: fd2 });
  const j2 = await r2.json();
  console.log("带文件提交:", r2.status, JSON.stringify(j2));

  // 3. 公开读取
  const r3 = await fetch(`${BASE}/api/footprints`);
  const list = await r3.json();
  console.log("公开列表:", r3.status, Array.isArray(list) ? list.length : "-", "条");
  for (const f of list.slice(0, 3)) {
    console.log(`  ${f.member} | ${f.date} | ${f.content.slice(0, 24)} | 附件:${f.attachment_path ? "有" : "无"}`);
  }

  // 4. 附件可读
  const withFile = list.find((f) => f.attachment_path);
  if (withFile) {
    const r4 = await fetch(`${BASE}/api/uploads/${withFile.attachment_path}`);
    console.log("附件读取:", r4.status, r4.headers.get("content-type"));
  }

  // 5. 非法文件名应 404
  const r5 = await fetch(`${BASE}/api/uploads/../app.db`);
  console.log("路径穿越防护:", r5.status);

  // 6. 超长内容应 400
  const fd6 = new FormData();
  fd6.set("member", "测试");
  fd6.set("content", "x".repeat(600));
  const r6 = await fetch(`${BASE}/api/footprints`, { method: "POST", body: fd6 });
  console.log("超长内容:", r6.status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

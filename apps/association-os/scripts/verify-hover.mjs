// CDP 验证脚本：模拟鼠标移动到 3D 物块上，对比 hover 前后像素
// 用法: node scripts/verify-hover.mjs
import fs from "node:fs";

const OUT_DIR = "D:/Agent-Operating-System/Projects/active/ai-association-os/evidence/stage-1";
const PORT = process.env.CDP_PORT ? Number(process.env.CDP_PORT) : 9333;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  // 等待 CDP 可用
  let targets = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      targets = await res.json();
      if (targets.length) break;
    } catch {
      await sleep(500);
    }
  }
  if (!targets) {
    console.error("CDP 不可用");
    process.exit(1);
  }

  const page = targets.find((t) => t.type === "page");
  if (!page) {
    console.error("找不到 page target");
    process.exit(1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });

  let msgId = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });

  function send(method, params = {}) {
    const id = ++msgId;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  console.log("navigate...");
  await send("Page.enable");
  await send("Page.navigate", { url: "http://localhost:3000" });
  await sleep(6000); // 等页面 + 3D 初始化

  // 截图 1：未 hover（鼠标在角落）
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5 });
  await sleep(800);
  const shot1 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${OUT_DIR}/hover-before.png`, Buffer.from(shot1.result.data, "base64"));
  console.log("saved hover-before.png");

  // 移动鼠标到物块上（canvas 从 x=240 开始，物块世界坐标 (-1.6, 0.4) → 屏幕约 (640, 248)）
  const pts = [
    [600, 200],
    [640, 248],
    [680, 280],
    [610, 300],
  ];
  for (const [x, y] of pts) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await sleep(150);
  }
  await sleep(1800); // 等 lerp 过渡完成

  const shot2 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${OUT_DIR}/hover-after.png`, Buffer.from(shot2.result.data, "base64"));
  console.log("saved hover-after.png");

  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

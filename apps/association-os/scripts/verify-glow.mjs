// 验证旋转光边：检查 .glow-frame 是否存在、::before 是否有 conic-gradient、--glow-angle 是否在变
import fs from "node:fs";

const PORT = process.env.CDP_PORT ? Number(process.env.CDP_PORT) : 9340;
const OUT_DIR = "D:/Agent-Operating-System/Projects/active/ai-association-os/evidence/stage-1";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let targets = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      targets = await res.json();
      if (targets.length) break;
    } catch {}
    await sleep(500);
  }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", rej);
  });

  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  const send = (method, params = {}) => {
    const i = ++id;
    return new Promise((r) => {
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: "http://localhost:3000" });
  await sleep(9000);

  const expr = `(() => {
    const el = document.querySelector('.glow-frame');
    if (!el) return JSON.stringify({ found: false });
    const before = getComputedStyle(el, '::before');
    const after = getComputedStyle(el, '::after');
    const cs = getComputedStyle(el);
    return JSON.stringify({
      found: true,
      rect: (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
      beforeBackground: before.backgroundImage ? before.backgroundImage.slice(0, 120) : 'none',
      beforeMaskComposite: before.maskComposite || before.webkitMaskComposite || 'n/a',
      beforeAnimation: before.animationName + ' ' + before.animationDuration,
      afterFilter: after.filter,
      glowAngle: cs.getPropertyValue('--glow-angle').trim(),
      isolation: cs.isolation,
      borderTop: cs.borderTopWidth + ' ' + cs.borderTopStyle,
    }, null, 2);
  })()`;

  const r1 = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  console.log("=== glow-frame 检查 ===");
  console.log(r1.result?.result?.value ?? JSON.stringify(r1));

  // 等 1.2s 再看 --glow-angle 是否变化
  await sleep(1200);
  const r2 = await send("Runtime.evaluate", {
    expression: `getComputedStyle(document.querySelector('.glow-frame')).getPropertyValue('--glow-angle').trim()`,
    returnByValue: true,
  });
  const r3 = await send("Runtime.evaluate", {
    expression: `(() => { const b = getComputedStyle(document.querySelector('.glow-frame'), '::before'); return b.animationName + ' | ' + b.animationDuration; })()`,
    returnByValue: true,
  });
  console.log("=== 1.2s 后 ===");
  console.log("--glow-angle:", r2.result?.result?.value);
  console.log("::before animation:", r3.result?.result?.value);

  // 截一张图存证
  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${OUT_DIR}/glow-check.png`, Buffer.from(shot.result.data, "base64"));
  console.log("saved glow-check.png");

  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

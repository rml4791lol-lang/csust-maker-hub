// 检查 canvas 的 pointer-events 链路与 hover 事件是否可达
import fs from "node:fs";

const PORT = 9334;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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
  await sleep(6000);

  const expr = `(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return JSON.stringify({ error: 'no canvas' });
    const chain = [];
    let el = canvas;
    let depth = 0;
    while (el && depth < 8) {
      const s = getComputedStyle(el);
      chain.push({
        tag: el.tagName,
        cls: String(el.className || '').slice(0, 60),
        pointerEvents: s.pointerEvents,
        position: s.position,
        zIndex: s.zIndex,
      });
      el = el.parentElement;
      depth++;
    }
    const r = canvas.getBoundingClientRect();
    const center = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2);
    return JSON.stringify({
      canvasRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      canvasPointerEvents: getComputedStyle(canvas).pointerEvents,
      whatIsOnTopAtCenter: center ? center.tagName + '.' + String(center.className||'').slice(0,40) : null,
      chain,
    }, null, 2);
  })()`;

  const result = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  console.log(result.result?.result?.value ?? JSON.stringify(result));

  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

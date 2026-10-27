// 量 hero 高度 + 玻璃窗内部滚动是否生效
import fs from "node:fs";

const PORT = process.env.CDP_PORT ? Number(process.env.CDP_PORT) : 9341;
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
    const hero = document.querySelector('section');
    const hr = hero ? hero.getBoundingClientRect() : null;
    const ul = document.querySelector('.glass-scroll');
    return JSON.stringify({
      heroHeight: hr ? Math.round(hr.height) : null,
      heroBottom: hr ? Math.round(hr.bottom) : null,
      viewport: window.innerHeight,
      heroTitleFont: (() => {
        const h1 = document.querySelector('h1');
        return h1 ? getComputedStyle(h1).fontSize : null;
      })(),
      glassList: ul ? {
        clientHeight: ul.clientHeight,
        scrollHeight: ul.scrollHeight,
        overflowY: getComputedStyle(ul).overflowY,
        canScroll: ul.scrollHeight > ul.clientHeight,
      } : null
    }, null, 2);
  })()`;

  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  console.log(r.result?.result?.value ?? JSON.stringify(r));

  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

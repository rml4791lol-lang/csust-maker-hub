#!/usr/bin/env tsx
/**
 * 最小后台：内容状态管理。
 *
 * 只做四件事：列表、预览、发布 / 退回、下架。
 * 编辑仍由 agent 改文件完成，这里不提供编辑器。
 *
 * 启动：pnpm admin
 * 默认账号：admin / admin123（用 ADMIN_USERS 环境变量覆盖，格式 user:pass,user:pass）
 */
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { exec, execFileSync } from 'node:child_process';
import { items } from '../src/data/items';
import { expiringSoon } from '../src/data/validate';

const ROOT = process.cwd();
const STATE_FILE = join(ROOT, 'src/data/publish-state.json');
const LOG_FILE = join(ROOT, 'src/data/review-log.json');
const PORT = Number(process.env.ADMIN_PORT || 3210);

type State = 'draft' | 'reviewing' | 'published' | 'unpublished';
const STATES: State[] = ['draft', 'reviewing', 'published', 'unpublished'];

function accounts(): Map<string, string> {
  const raw = process.env.ADMIN_USERS || 'admin:admin123';
  const map = new Map<string, string>();
  for (const pair of raw.split(',')) {
    const [u, p] = pair.split(':');
    if (u && p) map.set(u.trim(), p.trim());
  }
  return map;
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function authorized(req: http.IncomingMessage): string | null {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return null;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  return accounts().get(user) === pass ? user : null;
}

function currentState(id: string): State {
  const overrides = readJson<Record<string, State>>(STATE_FILE, {});
  if (overrides[id]) return overrides[id];
  return (items.find((i) => i.id === id)?.publishState as State) || 'draft';
}

function setState(id: string, next: State, actor: string, note = '') {
  const prev = currentState(id);
  const overrides = readJson<Record<string, State>>(STATE_FILE, {});
  overrides[id] = next;
  writeJson(STATE_FILE, overrides);

  const log = readJson<any[]>(LOG_FILE, []);
  log.unshift({
    id,
    from: prev,
    to: next,
    actor,
    method: 'human',
    note,
    at: new Date().toISOString(),
  });
  writeJson(LOG_FILE, log.slice(0, 500));
}

function page(actor: string): string {
  const rows = items
    .map((i) => {
      const st = currentState(i.id);
      const actions = STATES.filter((s) => s !== st)
        .map(
          (s) =>
            `<button class="op" data-id="${i.id}" data-state="${s}">${
              { draft: '退回草稿', reviewing: '待审', published: '发布', unpublished: '下架' }[s]
            }</button>`
        )
        .join('');
      return `<tr>
        <td class="mono">${i.id}</td>
        <td>${i.title}</td>
        <td><span class="tag">${i.type}</span></td>
        <td><span class="st st-${st}">${st}</span></td>
        <td class="ops">${actions}</td>
      </tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>内容后台 · 长理创客</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,"PingFang SC",sans-serif;background:#fafafa;color:#0a0a0a;font-size:14px;line-height:1.6}
  header{background:#fff;border-bottom:1px solid #e9e9e9;padding:14px 24px;display:flex;justify-content:space-between;align-items:center}
  h1{font-size:15px;margin:0}
  .who{font-size:12px;color:#8a8a8a}
  main{max-width:1100px;margin:0 auto;padding:24px}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e9e9e9;border-radius:10px;overflow:hidden}
  th,td{text-align:left;padding:11px 12px;border-bottom:1px solid #e9e9e9;vertical-align:middle}
  th{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#8a8a8a;font-weight:500;background:#fafafa}
  tr:hover td{background:#f7f7f7}
  .mono{font-family:ui-monospace,monospace;font-size:11.5px;color:#8a8a8a}
  .tag{font-size:10.5px;border:1px solid #e9e9e9;border-radius:4px;padding:1px 6px;color:#525252}
  .st{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid #e9e9e9}
  .st-published{color:#16a34a;border-color:#bbe7c9;background:#f2fbf5}
  .st-reviewing{color:#1a56db;border-color:#c7d7fb;background:#f1f5fd}
  .st-draft{color:#525252;background:#f5f5f5}
  .st-unpublished{color:#dc2626;border-color:#fecaca;background:#fef2f2}
  .ops{display:flex;gap:6px;flex-wrap:wrap}
  .op{font:inherit;font-size:12px;padding:4px 10px;border:1px solid #d6d6d6;border-radius:6px;background:#fff;cursor:pointer;color:#525252}
  .op:hover{border-color:#1a56db;color:#1a56db}
  #msg{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0a0a0a;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;display:none}
  .note{color:#8a8a8a;font-size:12px;margin:0 0 16px}
  .soon{border:1px solid #e9e9e9;background:#fafafa;border-radius:10px;padding:10px 16px;margin-bottom:12px;font-size:12.5px;display:flex;gap:10px;flex-wrap:wrap}
  .soon b{color:#b45309;font-weight:600}
  .soon span{color:#8a8a8a}
  .rules{border:1px solid #fde2b8;background:#fffbf2;border-radius:10px;padding:12px 16px;margin-bottom:16px;display:grid;gap:6px;font-size:12.5px}
  .rules b{font-size:12px;color:#b45309;margin-bottom:2px}
  .rules label{display:flex;gap:8px;align-items:center;color:#525252;cursor:pointer}
</style></head>
<body>
<header><h1>内容后台</h1><span class="who">${actor}</span></header>
<main>
  <div class="rules">
    <b>发布前逐条确认：</b>
    <label><input type="checkbox" class="rule"> 不涉政治、宗教、民族敏感内容</label>
    <label><input type="checkbox" class="rule"> 不含他人隐私与未公开数据</label>
    <label><input type="checkbox" class="rule"> 不转载未授权付费内容与破解教程</label>
  </div>
  ${(() => {
    const soon = expiringSoon(items);
    if (!soon.length) return '';
    return `<div class="soon"><b>${soon.length} 条即将到期</b><span>${soon.map((i) => `${i.title}（${i.expiresAt}）`).join('、')}</span></div>`;
  })()}
  <p class="note">改状态会写入发布记录。过期内容会自动从列表下架，详情页标注已截止。</p>
  <table>
    <thead><tr><th>ID</th><th>标题</th><th>类型</th><th>状态</th><th>操作</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
<div id="msg"></div>
<script>
  const msg = document.getElementById('msg');
  function toast(t){ msg.textContent=t; msg.style.display='block'; setTimeout(()=>msg.style.display='none',2200); }
  document.querySelectorAll('.op').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id, state = btn.dataset.state;
      if (state === 'published') {
        const all = [...document.querySelectorAll('.rule')];
        const ok = all.every(r => r.checked);
        if (!ok) { toast('发布前先确认三条合规红线'); return; }
        if (!confirm('确认发布？三条合规红线已逐条核对。')) return;
      }
      btn.disabled = true;
      try {
        const r = await fetch('/api/state', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ id, state }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || '操作失败');
        toast('已改为 ' + state);
        setTimeout(()=>location.reload(), 500);
      } catch (e) {
        toast('失败：' + e.message);
        btn.disabled = false;
      }
    });
  });
</script>
</body></html>`;
}

const server = http.createServer((req, res) => {
  const actor = authorized(req);
  if (!actor) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="admin"' });
    res.end('需要登录');
    return;
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page(actor));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/state') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { id, state } = JSON.parse(body || '{}');
        if (!id || !STATES.includes(state)) throw new Error('参数不合法');
        if (!items.some((i) => i.id === id)) throw new Error('内容不存在：' + id);
        setState(id, state, actor);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id, state }));
      } catch (e: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`后台已启动：http://127.0.0.1:${PORT}  （账号见 ADMIN_USERS，默认 admin / admin123）`);
});

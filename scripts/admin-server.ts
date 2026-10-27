#!/usr/bin/env tsx
/**
 * 最小后台 + agent 接口。
 *
 * 人用：浏览器打开 /，账号密码登录，点发布/退回/下架。
 * agent 用：带 Bearer token 调 /api/*，可以直接写内容和改状态。
 *
 * 启动：pnpm admin
 * 环境变量：
 *   ADMIN_USERS="admin:admin123,editor:xxx"  人用账号
 *   AGENT_TOKEN="..."                        agent 用 token
 *   ADMIN_PORT=3210
 *   FEISHU_WEBHOOK=...                       飞书自定义机器人 webhook（可选）
 *   FEISHU_SECRET=...                        飞书签名密钥（配 FEISHU_WEBHOOK 时用）
 *   WECOM_WEBHOOK=...                        企业微信群机器人 webhook（可选）
 *   REVIEW_DAYS=90                           复核周期天数（默认 90，issue #13）
 * 密钥只放服务器 env 文件（.env.admin），绝不入 git。
 */
import http from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { items } from '../src/data/items';
import { members } from '../src/data/members';
import { expiringSoon, validateContent } from '../src/data/validate';
import { SITE_BASE, sendIm, imChannel } from './im-push';
import { overdueReviews } from '../src/data/review';
import { voteLabel } from '../src/data/vote-labels';
import { validateSubmission } from '../src/data/contributions';

const ROOT = process.cwd();
const CONTENT_FILE = join(ROOT, 'content/items.json');
const STATE_FILE = join(ROOT, 'src/data/publish-state.json');
const LOG_FILE = join(ROOT, 'src/data/review-log.json');
/** 运行时指标：浏览量 + 反馈。线上服务器持有，gitignore，构建时被 src/data/metrics.ts 读走 */
const METRICS_FILE = join(ROOT, 'metrics.json');
/** 功能开关与工具目录：构建时被 src/data/flags.ts、tools.ts 读走，后台切换后需重新构建 */
const FLAGS_FILE = join(ROOT, 'content/flags.json');
const TOOLS_FILE = join(ROOT, 'content/tools.json');
/** 成员成果投稿（成员自己填，后台审核） */
const SUBMISSIONS_FILE = join(ROOT, 'content/submissions.json');
/** 成员 AI 档案（agent 读投稿后写入） */
const PROFILES_FILE = join(ROOT, 'content/profiles.json');
const PORT = Number(process.env.ADMIN_PORT || 3210);
const AGENT_TOKEN = process.env.AGENT_TOKEN || '';
/** 多 agent token：AGENT_TOKENS="token:loong333,token2:Qiu-Py"——日志与审核记录按名字区分操作人 */
const AGENT_TOKENS: { token: string; name: string }[] = [
  ...(AGENT_TOKEN ? [{ token: AGENT_TOKEN, name: '站长' }] : []),
  ...(process.env.AGENT_TOKENS || '')
    .split(',')
    .map((pair) => pair.split(':'))
    .filter(([token]) => (token || '').trim())
    .map(([token, name]) => ({ token: token.trim(), name: (name || 'agent').trim() })),
];
/** 部署目标目录。设置后 /api/build 构建成功会 rsync 过去（服务器本机路径，如 /var/www/csust-maker/） */
const DEPLOY_TARGET = process.env.DEPLOY_TARGET || '';
/** 复核周期天数：超过该天数未复核的已发布内容进「待复核」清单（issue #13） */
const REVIEW_DAYS = Number(process.env.REVIEW_DAYS) > 0 ? Number(process.env.REVIEW_DAYS) : 90;

type State = 'draft' | 'reviewing' | 'published' | 'rejected' | 'unpublished';
const STATES: State[] = ['draft', 'reviewing', 'published', 'rejected', 'unpublished'];

/** HTML 转义：后台页面所有动态内容都经过它，避免内容作者注入脚本 */
const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** 成员投稿限流：同一 IP 10 分钟最多 5 条（进程内，够用） */
const contributeHits = new Map<string, number[]>();
function allowContribution(ip: string): boolean {
  const now = Date.now();
  const hits = (contributeHits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (hits.length >= 5) return false;
  hits.push(now);
  contributeHits.set(ip, hits);
  return true;
}

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

type Who = { role: 'human'; user: string } | { role: 'agent'; user: string } | null;

function identify(req: http.IncomingMessage): Who {
  const header = req.headers.authorization || '';
  const agentHit = AGENT_TOKENS.find((t) => header === `Bearer ${t.token}`);
  if (agentHit) return { role: 'agent', user: agentHit.name };
  if (header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    if (accounts().get(user) === pass) return { role: 'human', user };
  }
  return null;
}

function currentState(id: string): State {
  const overrides = readJson<Record<string, State>>(STATE_FILE, {});
  if (overrides[id]) return overrides[id];
  return (items.find((i) => i.id === id)?.publishState as State) || 'draft';
}

function logTransition(entry: Record<string, unknown>) {
  const log = readJson<any[]>(LOG_FILE, []);
  log.unshift({ ...entry, at: new Date().toISOString() });
  writeJson(LOG_FILE, log.slice(0, 500));
}

function setState(id: string, next: State, actor: string, method: 'human' | 'agent', note = '') {
  const prev = currentState(id);
  const overrides = readJson<Record<string, State>>(STATE_FILE, {});
  overrides[id] = next;
  writeJson(STATE_FILE, overrides);
  logTransition({ id, from: prev, to: next, actor, method, note });

  // 发布时把审核人/时间/方式写进条目本身，详情页要展示（spec：每条记录审核信息）
  if (next === 'published') {
    const list = readItems();
    const idx = list.findIndex((i) => i.id === id);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        reviewer: actor,
        reviewedAt: new Date().toISOString().slice(0, 10),
        reviewMethod: method,
      };
      writeItems(list);
    }
  }

  if (next === 'published' && prev !== 'published') notifyPublished(id, actor, method);
}

function readItems(): any[] {
  return readJson<any[]>(CONTENT_FILE, []);
}
function writeItems(list: any[]) {
  writeJson(CONTENT_FILE, list);
}

/* ---------------------------- IM 群机器人推送（issue #10，通道实现见 scripts/im-push.ts） ---------------------------- */

/** 发布卡片内容：标题 / 作者 / 一句话摘要 / 详情页链接 */
function publishCard(id: string) {
  const entry =
    readItems().find((i) => i.id === id) || items.find((i) => i.id === id) || ({} as any);
  return {
    title: String(entry.title || id),
    author: String(entry.author || '未署名'),
    summary: String(entry.summary || '').slice(0, 120),
    link: `${SITE_BASE}/library/${id}`,
  };
}

/** 条目发布后推送 IM 群。异步、不阻塞状态流转；失败只记日志。未配置 webhook 时 dry-run 打印卡片。 */
function notifyPublished(id: string, actor: string, method: 'human' | 'agent') {
  const card = publishCard(id);
  void sendIm(
    {
      header: `📄 新内容发布：${card.title}`,
      body: `**作者**：${card.author}\n**摘要**：${card.summary}`,
      buttons: [{ text: '查看详情', url: card.link }],
    },
    'im-push',
    `${id}（${actor}）`
  );
}

/* ---------------------------- 人的页面 ---------------------------- */

function page(actor: string): string {
  const live = readItems();
  const rows = live
    .map((i) => {
      const st = currentState(i.id);
      const actions = STATES.filter((s) => s !== st)
        .map(
          (s) =>
            `<button class="op" data-id="${esc(i.id)}" data-state="${s}">${
              { draft: '退回草稿', reviewing: '待审', published: '发布', rejected: '退回', unpublished: '下架' }[s]
            }</button>`
        )
        .join('');
      return `<tr>
        <td class="mono">${esc(i.id)}</td>
        <td>${esc(i.title)}</td>
        <td><span class="tag">${esc(i.type)}</span></td>
        <td><span class="st st-${st}">${esc(st)}</span></td>
        <td class="ops"><button class="op" data-preview="${esc(i.id)}">预览</button>${actions}</td>
      </tr>`;
    })
    .join('');

  const soon = expiringSoon(live as any);
  const soonHtml = soon.length
    ? `<div class="soon"><b>${soon.length} 条即将到期</b><span>${soon
        .map((i) => `${esc(i.title)}（${esc(i.expiresAt)}）`)
        .join('、')}</span></div>`
    : '';

  // 缺作者清单：warn 级校验问题，供逐条认领（issue #9）
  const noAuthor = validateContent({ items: live as any, members }).filter(
    (i) => i.code === 'missing-author'
  );
  const noAuthorHtml = noAuthor.length
    ? `<div class="soon noauthor"><b>${noAuthor.length} 条缺作者</b><span>${noAuthor
        .map((i) => {
          const it = live.find((x) => x.id === i.id);
          return `${esc(it?.title ?? '')}（<span class="mono">${esc(i.id)}</span>）`;
        })
        .join('、')}</span></div>`
    : '';

  // 待复核清单：已发布且最近复核超 REVIEW_DAYS 天，一键刷新复核时间（issue #13）
  const dueReview = overdueReviews(
    live.map((i) => ({ ...i, publishState: currentState(i.id) })),
    readJson<any[]>(LOG_FILE, []),
    new Date(),
    REVIEW_DAYS
  );
  const reviewHtml = dueReview.length
    ? `<div class="soon overdue"><b>${dueReview.length} 条待复核（超 ${REVIEW_DAYS} 天未复核）</b>${dueReview
        .map(
          (i) =>
            `<span>${esc(i.title)}（<span class="mono">${esc(i.id)}</span>）· 最近复核：${
              i.lastReviewAt ? esc(i.lastReviewAt.slice(0, 10)) : '无记录'
            } <button class="op" data-review="${esc(i.id)}">完成复核</button></span>`
        )
        .join('')}</div>`
    : '';

  // 反馈汇总：有用/没用/照做计数 + 最近留言（spec user story #20 + issue #11）
  const m = readMetrics();
  const fbAgg: Record<string, { useful: number; useless: number; confirmed: number }> = {};
  for (const f of m.feedback) (fbAgg[f.item] ??= { useful: 0, useless: 0, confirmed: 0 })[f.vote]++;
  const fbRows = Object.entries(fbAgg)
    .sort((a, b) => b[1].useful + b[1].useless + b[1].confirmed - (a[1].useful + a[1].useless + a[1].confirmed))
    .map(([id, c]) => {
      const it = live.find((i) => i.id === id);
      return `<tr><td class="mono">${esc(id)}</td><td>${esc(it?.title ?? id)}</td><td>${c.useful}</td><td>${c.useless}</td><td>${c.confirmed}</td></tr>`;
    })
    .join('');
  const fbHtml =
    m.feedback.length || Object.keys(m.views).length
      ? `<div class="fbpanel">
    <b>反馈与浏览</b>
    <span>总浏览 ${Object.values(m.views).reduce((a, b) => a + b, 0)} 次 · 反馈 ${m.feedback.length} 条</span>
    ${
      fbRows
        ? `<table class="fbtable"><tr><th>条目</th><th>标题</th><th>有用</th><th>没用</th><th>照做</th></tr>${fbRows}</table>`
        : ''
    }
    ${
      m.feedback.length
        ? `<ul class="fbnotes">${m.feedback
            .slice(-8)
            .reverse()
            .map(
              (f) =>
                `<li><span class="mono">${esc(f.item)}</span> · ${esc(voteLabel[f.vote] ?? f.vote)}${
                  f.note ? ` · 「${esc(f.note)}」` : ''
                } · ${esc(f.at.slice(0, 10))}</li>`
            )
            .join('')}</ul>`
        : ''
    }
  </div>`
      : '';

  // 功能开关与工具目录（issue: 功能开关/工具导航；构建时生效）
  const flagsNow = readJson<any[]>(FLAGS_FILE, []);
  const audText = (a: string) => (a === 'all' ? '全员' : a === 'core' ? '核心' : a);
  const flagsHtml = flagsNow.length
    ? `<div class="cfgbox"><b>功能开关</b><span>切换后要点一次下方「重新构建」才生效（静态站，构建时应用）。受众是标注说明——静态站无登录，不做按人隔离。</span>
    ${flagsNow
      .map(
        (f) =>
          `<div class="cfgrow"><span class="cfg-label">${esc(f.label)}</span><span class="cfg-aud">面向${esc(audText(f.audience))}</span>${
            f.note ? `<span class="cfg-note">${esc(f.note)}</span>` : ''
          }<button class="op flagtoggle" data-key="${esc(f.key)}" data-on="${f.enabled ? 1 : 0}">${
            f.enabled ? '已启用 · 停用' : '已停用 · 启用'
          }</button></div>`
      )
      .join('')}
  </div>`
    : '';
  const toolsNow = readJson<any[]>(TOOLS_FILE, []);
  const toolsHtml = toolsNow.length
    ? `<div class="cfgbox"><b>工具站目录</b><span>${toolsNow.length} 条，展示在 /tools。编辑走 <code>PUT /api/tools</code>（整表替换），改完重新构建。</span>
    ${toolsNow
      .map((t) => `<div class="cfgrow"><span class="cfg-label">${esc(t.name)}</span><span class="cfg-aud">面向${esc(audText(t.audience))}</span><span class="cfg-note">${esc(t.status ?? '正常')} · ${esc(t.url)}</span></div>`)
      .join('')}
  </div>`
    : '';

  // 成员投稿（成员成果平台）
  const subsNow = readJson<any[]>(SUBMISSIONS_FILE, []);
  const pendingSubs = subsNow.filter((s) => s.status === 'pending');
  const subsHtml = subsNow.length
    ? `<div class="cfgbox"><b>成员投稿</b><span>共 ${subsNow.length} 条，待审核 ${pendingSubs.length} 条。发布后出现在成员档案与成果墙；退回可写原因。AI 汇总走 <code>PUT /api/profiles</code>。</span>
    ${subsNow
      .slice(0, 20)
      .map(
        (s) =>
          `<div class="sub"><div class="sub-main"><span class="mono">${esc(s.id)}</span> <b>${esc(s.title)}</b><span class="sub-meta">${esc(s.memberName)} · ${esc(s.date)} · ${esc(s.type)} · ${esc(s.status)}</span><p>${esc(s.description)}</p></div><div class="ops">${
            s.status !== 'published'
              ? `<button class="op" data-sub="${esc(s.id)}" data-sub-state="published">发布</button>`
              : ''
          }${
            s.status !== 'rejected'
              ? `<button class="op" data-sub="${esc(s.id)}" data-sub-state="rejected">退回</button>`
              : ''
          }</div></div>`
      )
      .join('')}
  </div>`
    : '';

  // IM 推送状态（issue #10）
  const imChannelNow = imChannel();
  const imStatus = imChannelNow
    ? `IM 推送：已启用（${imChannelNow === 'feishu' ? '飞书' : '企业微信'}）`
    : 'IM 推送：未配置（dry-run）';

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
  .st-rejected{color:#b45309;border-color:#fde2b8;background:#fffbf2}
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
  .noauthor b{color:#1a56db}
  .fbpanel{border:1px solid #e9e9e9;background:#fff;border-radius:10px;padding:12px 16px;margin-bottom:12px;font-size:12.5px;display:grid;gap:8px}
  .fbpanel>b{font-weight:600}
  .fbpanel>span{color:#8a8a8a;font-size:12px}
  .fbtable{border:1px solid #e9e9e9;border-radius:8px;overflow:hidden}
  .fbtable th{background:#fafafa;padding:7px 10px}
  .fbtable td{padding:7px 10px}
  .fbnotes{margin:0;padding-left:18px;color:#525252;display:grid;gap:4px}
  .rules{border:1px solid #fde2b8;background:#fffbf2;border-radius:10px;padding:12px 16px;margin-bottom:16px;display:grid;gap:6px;font-size:12.5px}
  .rules b{font-size:12px;color:#b45309;margin-bottom:2px}
  .rules label{display:flex;gap:8px;align-items:center;color:#525252;cursor:pointer}
  .api{margin-top:28px;border:1px solid #e9e9e9;background:#fff;border-radius:10px;padding:16px 20px;font-size:12.5px;color:#525252}
  .api h2{font-size:13px;margin:0 0 8px}
  .api code{font-family:ui-monospace,monospace;font-size:11.5px;background:#fafafa;border:1px solid #e9e9e9;border-radius:4px;padding:1px 5px}
  .api p{margin:6px 0}
  .cfgbox{border:1px solid #e9e9e9;background:#fff;border-radius:10px;padding:12px 16px;margin-bottom:12px;font-size:12.5px;display:grid;gap:8px}
  .cfgbox>b{font-weight:600}
  .cfgbox>span{color:#8a8a8a;font-size:12px}
  .cfgbox code{font-family:ui-monospace,monospace;font-size:11px;background:#fafafa;border:1px solid #e9e9e9;border-radius:4px;padding:1px 5px}
  .cfgrow{display:grid;grid-template-columns:150px 90px 1fr 130px;gap:10px;align-items:center;padding:7px 0;border-top:1px solid #f0f0f0}
  .cfg-label{font-weight:500}
  .cfg-aud{color:#1a56db;font-size:11.5px;white-space:nowrap}
  .cfg-note{color:#8a8a8a;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cfgrow .op{justify-self:end}
  /* 预览弹层 */
  .pv{position:fixed;inset:0;z-index:50;display:grid;place-items:center}
  .pv[hidden]{display:none}
  .pv-bg{position:absolute;inset:0;background:rgba(10,10,10,.5)}
  .pv-panel{position:relative;width:min(760px,92vw);max-height:84vh;display:flex;flex-direction:column;background:#fff;border:1px solid #e9e9e9;border-radius:12px;box-shadow:0 30px 80px -20px rgba(0,0,0,.4);overflow:hidden}
  .pv-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e9e9e9}
  .pv-head b{font-size:14px}
  .pv-body{padding:18px;overflow:auto;font-size:13px}
  .pv-body h1{font-size:20px;margin:0 0 6px}
  .pv-meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;color:#8a8a8a;font-size:11.5px}
  .pv-sec{margin-top:16px}
  .pv-sec h3{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a8a8a;margin:0 0 6px;font-weight:600}
  .pv-sec p,.pv-sec li{color:#3f3f3f;line-height:1.75;font-size:13px;margin:0}
  .pv-sec ol,.pv-sec ul{margin:0;padding-left:20px;display:grid;gap:6px}
  .pv-sec pre{background:#fafafa;border:1px solid #e9e9e9;border-radius:8px;padding:12px;white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px;margin:0}
  /* 成员投稿 */
  .sub{display:flex;gap:14px;justify-content:space-between;align-items:flex-start;padding:10px 0;border-top:1px solid #f0f0f0;font-size:12.5px}
  .sub-main{display:grid;gap:3px;min-width:0}
  .sub-main b{font-size:13px;color:#0a0a0a}
  .sub-meta{color:#8a8a8a;font-size:11.5px}
  .sub-main p{margin:2px 0 0;color:#525252;font-size:12px;line-height:1.6;max-width:70ch}
</style></head>
<body>
<header><h1>内容后台</h1><span class="who">${esc(actor)}</span></header>
<main>
  ${soonHtml}
  ${noAuthorHtml}
  ${reviewHtml}
  ${fbHtml}
  ${flagsHtml}
  ${toolsHtml}
  ${subsHtml}
  <div class="rules">
    <b>发布前逐条确认：</b>
    <label><input type="checkbox" class="rule"> 不涉政治、宗教、民族敏感内容</label>
    <label><input type="checkbox" class="rule"> 不含他人隐私与未公开数据</label>
    <label><input type="checkbox" class="rule"> 不转载未授权付费内容与破解教程</label>
  </div>
  <p class="note">${imStatus}。改状态会写入发布记录，发布即推送群通知。过期内容保留展示，仅标注已截止。</p>
  <table>
    <thead><tr><th>ID</th><th>标题</th><th>类型</th><th>状态</th><th>操作</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="api">
    <h2>agent 接口</h2>
    <p>请求头带 <code>Authorization: Bearer $AGENT_TOKEN</code></p>
    <p><code>GET /api/items</code> 列表 · <code>GET /api/items/:id</code> 单条</p>
    <p><code>PUT /api/items/:id</code> 新建或更新（JSON body，写入 content/items.json）</p>
    <p><code>DELETE /api/items/:id</code> 删除</p>
    <p><code>POST /api/state</code> body <code>{"id":"g01","state":"published"}</code></p>
    <p><code>POST /api/review</code> body <code>{"id":"g01"}</code> 完成复核（盖复核章，写 review-log）</p>
    <p><b>成员成果平台：</b>公开 <code>POST /api/contribute</code>（成员投稿，待审核）；<code>GET /api/submissions</code> 投稿列表；<code>POST /api/submissions/:id/status</code> body <code>{"status":"published","note":""}</code> 审核；<code>GET /api/profiles</code> / <code>PUT /api/profiles</code>（agent 写 AI 汇总，整表替换）</p>
    <p><code>POST /api/build</code> 重新构建并部署</p>
  </div>
</main>
<div class="pv" id="pv" hidden>
  <div class="pv-bg" data-pv-close></div>
  <div class="pv-panel" role="dialog" aria-modal="true" aria-label="内容预览">
    <div class="pv-head"><b>内容预览</b><button class="op" data-pv-close>关闭</button></div>
    <div class="pv-body" id="pvBody"></div>
  </div>
</div>
<div id="msg"></div>
<script>
  const msg = document.getElementById('msg');
  function toast(t){ msg.textContent=t; msg.style.display='block'; setTimeout(()=>msg.style.display='none',2200); }
  document.querySelectorAll('.op[data-state]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id, state = btn.dataset.state;
      let note = '';
      if (state === 'published') {
        const all = [...document.querySelectorAll('.rule')];
        if (!all.every(r => r.checked)) { toast('发布前先确认三条合规红线'); return; }
        if (!confirm('确认发布？三条合规红线已逐条核对。')) return;
      }
      if (state === 'rejected') {
        const reason = prompt('退回原因（会写入 review-log，可留空）：', '');
        if (reason === null) return;
        note = reason;
      }
      btn.disabled = true;
      try {
        const r = await fetch('api/state', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ id: id, state: state, note: note }),
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

  // ---- 预览弹层（spec：后台四件事之一）----
  const pv = document.getElementById('pv');
  const pvBody = document.getElementById('pvBody');
  const pvEsc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pvSec = (title, inner) => inner ? '<div class="pv-sec"><h3>' + pvEsc(title) + '</h3>' + inner + '</div>' : '';
  const pvList = (arr) => Array.isArray(arr) && arr.length ? '<ol>' + arr.map(x => '<li>' + pvEsc(x) + '</li>').join('') + '</ol>' : '';
  function renderPreview(it) {
    const e = it.extra || {};
    const typeLabel = {guide:'攻略',skill:'技能指令',template:'模板素材',link:'外部项目',training:'培训',project:'项目',competition:'竞赛',activity:'活动',course:'课程',video:'视频'}[it.type] || it.type;
    let html = '<h1>' + pvEsc(it.title) + '</h1><div class="pv-meta">';
    html += '<span class="mono">' + pvEsc(it.id) + '</span><span class="tag">' + pvEsc(typeLabel) + '</span>';
    html += '<span>' + pvEsc(it.publishState) + '</span><span>' + pvEsc(it.date) + '</span>';
    if (it.author) html += '<span>作者 ' + pvEsc(it.author) + '</span>';
    if (it.reviewer) html += '<span>审核 ' + pvEsc(it.reviewer) + ' · ' + pvEsc(it.reviewedAt || '') + (it.reviewMethod ? ' · ' + pvEsc(it.reviewMethod) : '') + '</span>';
    html += '</div><p>' + pvEsc(it.summary) + '</p>';
    html += pvSec('问题场景', e.scene ? '<p>' + pvEsc(e.scene) + '</p>' : '');
    html += pvSec('现成路径', pvList(e.path));
    html += pvSec('可复制提示词', e.prompt ? '<pre>' + pvEsc(e.prompt) + '</pre>' : '');
    html += pvSec('常见错误', e.pitfalls && e.pitfalls.length ? '<ul>' + e.pitfalls.map(p => '<li>' + pvEsc(p) + '</li>').join('') + '</ul>' : '');
    html += pvSec('使用记录', e.usage ? '<p>' + pvEsc(e.usage) + '</p>' : '');
    html += pvSec('来源', e.sourceUrl ? '<p>' + pvEsc(e.sourceName || e.sourceUrl) + ' · ' + pvEsc(e.sourceUrl) + '</p>' : '');
    html += pvSec('指令', e.command ? '<pre>' + pvEsc(e.command) + '</pre>' : '');
    html += pvSec('适用', e.appliesTo ? '<p>' + pvEsc(e.appliesTo) + '</p>' : '');
    html += pvSec('下载', e.downloadUrl ? '<p>' + pvEsc(e.downloadUrl) + '</p>' : '');
    html += pvSec('外部链接', e.url ? '<p>' + pvEsc(e.url) + '</p>' : '');
    html += pvSec('培训信息', e.kind ? '<p>' + pvEsc(e.kind) + (e.deadline ? ' · 截止 ' + pvEsc(e.deadline) : '') + (e.materials ? ' · ' + pvEsc(e.materials) : '') + '</p>' : '');
    html += pvSec('课程大纲', pvList(e.outline));
    html += pvSec('复盘', e.recap ? '<p>' + pvEsc(e.recap) + '</p>' : '');
    html += pvSec('交付形态', e.deliverable ? '<p>' + pvEsc(e.deliverable) + '</p>' : '');
    const race = [e.level, e.team, e.award].filter(Boolean).join(' · ');
    html += pvSec('竞赛信息', race ? '<p>' + pvEsc(race) + '</p>' : '');
    html += pvSec('标签', it.tags && it.tags.length ? '<p>' + it.tags.map(t => '<span class="tag">' + pvEsc(t) + '</span>').join(' ') + '</p>' : '');
    html += pvSec('参与人', it.people && it.people.length ? '<p>' + it.people.map(pvEsc).join('、') + '</p>' : '');
    pvBody.innerHTML = html;
    pv.hidden = false;
  }
  document.querySelectorAll('[data-preview]').forEach(btn => btn.addEventListener('click', async () => {
    try {
      const r = await fetch('api/items/' + encodeURIComponent(btn.dataset.preview));
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '读取失败');
      renderPreview(d);
    } catch (e) {
      toast('预览失败：' + e.message);
    }
  }));
  document.querySelectorAll('[data-pv-close]').forEach(el => el.addEventListener('click', () => { pv.hidden = true; }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') pv.hidden = true; });

  // ---- 成员投稿审核 ----
  document.querySelectorAll('[data-sub]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.sub, state = btn.dataset.subState;
    let note = '';
    if (state === 'rejected') {
      const reason = prompt('退回原因（会写入审核记录，可留空）：', '');
      if (reason === null) return;
      note = reason;
    }
    if (state === 'published' && !confirm('发布这条投稿？发布后出现在成员档案与成果墙。')) return;
    btn.disabled = true;
    try {
      const r = await fetch('api/submissions/' + encodeURIComponent(id) + '/status', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ status: state, note: note }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '操作失败');
      toast('已处理，重新构建后前台可见');
      setTimeout(()=>location.reload(), 500);
    } catch (e) {
      toast('失败：' + e.message);
      btn.disabled = false;
    }
  }));
  document.querySelectorAll('[data-review]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const r = await fetch('api/review', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ id: btn.dataset.review }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || '操作失败');
        toast('已记录复核');
        setTimeout(()=>location.reload(), 500);
      } catch (e) {
        toast('失败：' + e.message);
        btn.disabled = false;
      }
    });
  });

  // 功能开关切换：保存后提示重新构建（静态站构建时生效）
  document.querySelectorAll('.flagtoggle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.key, on = btn.dataset.on === '1';
      btn.disabled = true;
      try {
        const r = await fetch('api/flags', {
          method: 'PUT',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ key, enabled: !on }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || '操作失败');
        toast('已切换，点「重新构建」生效');
        setTimeout(()=>location.reload(), 600);
      } catch (e) {
        toast('失败：' + e.message);
        btn.disabled = false;
      }
    });
  });
</script>
</body></html>`;
}

/* ---------------------------- HTTP ---------------------------- */

function json(res: http.ServerResponse, code: number, data: unknown, headers: Record<string, string> = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(data));
}

type MetricsFile = {
  views: Record<string, number>;
  feedback: { item: string; vote: 'useful' | 'useless' | 'confirmed'; note?: string; at: string }[];
  updatedAt?: string;
};

function readMetrics(): MetricsFile {
  try {
    return { views: {}, feedback: [], ...JSON.parse(readFileSync(METRICS_FILE, 'utf8')) };
  } catch {
    return { views: {}, feedback: [] };
  }
}

function writeMetrics(m: MetricsFile) {
  writeFileSync(METRICS_FILE, JSON.stringify(m, null, 2) + '\n');
}

function body(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => (d += c));
    req.on('end', () => resolve(d));
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  // ---------- 公开接口（无需登录）：浏览打点 / 反馈 / 聚合指标 ----------
  if (req.method === 'OPTIONS' && (url === '/api/track' || url === '/api/feedback')) {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }
  if (url === '/api/track' || url === '/api/feedback' || url === '/api/metrics') {
    const CORS = { 'Access-Control-Allow-Origin': '*' };
    if (req.method === 'GET' && url === '/api/metrics') {
      const m = readMetrics();
      const fb: Record<string, { useful: number; useless: number; confirmed: number }> = {};
      for (const f of m.feedback) {
        (fb[f.item] ??= { useful: 0, useless: 0, confirmed: 0 })[f.vote]++;
      }
      const total = Object.values(m.views).reduce((a, b) => a + b, 0);
      return json(res, 200, { total, views: m.views, feedback: fb, updatedAt: m.updatedAt ?? null }, CORS);
    }
    if (req.method === 'POST' && (url === '/api/track' || url === '/api/feedback')) {
      const raw = await body(req);
      if (raw.length > 2048) return json(res, 413, { error: 'payload too large' }, CORS);
      let p: any;
      try {
        p = JSON.parse(raw);
      } catch {
        return json(res, 400, { error: 'bad json' }, CORS);
      }
      const ids = new Set(readItems().map((i) => i.id));
      const m = readMetrics();
      if (url === '/api/track') {
        const id = String(p?.id ?? '');
        if (!ids.has(id)) return json(res, 400, { error: 'unknown id' }, CORS);
        m.views[id] = (m.views[id] || 0) + 1;
      } else {
        const id = String(p?.item ?? '');
        const vote = String(p?.vote ?? '');
        if (!ids.has(id)) return json(res, 400, { error: 'unknown id' }, CORS);
        if (!['useful', 'useless', 'confirmed'].includes(vote)) return json(res, 400, { error: 'bad vote' }, CORS);
        m.feedback.push({ item: id, vote, note: String(p?.note ?? '').slice(0, 200), at: new Date().toISOString() });
        if (m.feedback.length > 500) m.feedback = m.feedback.slice(-500);
      }
      m.updatedAt = new Date().toISOString();
      writeMetrics(m);
      return json(res, 200, { ok: true }, CORS);
    }
    return json(res, 405, { error: 'method not allowed' }, CORS);
  }

  // ---------- 公开接口：成员成果投稿（成员自己填写，待审核） ----------
  if (url === '/api/contribute') {
    const CORS = { 'Access-Control-Allow-Origin': '*' };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return res.end();
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' }, CORS);
    const ip =
      String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown';
    if (!allowContribution(ip)) return json(res, 429, { error: '提交太频繁，请 10 分钟后再试' }, CORS);
    const raw = await body(req);
    if (raw.length > 8192) return json(res, 413, { error: '内容过长' }, CORS);
    let p: any;
    try {
      p = JSON.parse(raw);
    } catch {
      return json(res, 400, { error: 'bad json' }, CORS);
    }
    const issues = validateSubmission(p);
    if (issues.length) return json(res, 400, { error: '提交未通过校验', issues }, CORS);
    const member = members.find((m) => m.id === String(p.memberId))!;
    const list = readJson<any[]>(SUBMISSIONS_FILE, []);
    const id = 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    list.push({
      id,
      memberId: member.id,
      memberName: member.name,
      dept: member.dept,
      type: p.type,
      title: String(p.title).trim(),
      date: p.date,
      description: String(p.description).trim(),
      outcome: p.outcome ? String(p.outcome).trim() : undefined,
      link: p.link ? String(p.link).trim() : undefined,
      image: p.image ? String(p.image).trim() : undefined,
      evidence: p.evidence ? String(p.evidence).trim() : undefined,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      source: 'form',
    });
    writeJson(SUBMISSIONS_FILE, list);
    logTransition({ id, from: '-', to: 'pending', actor: 'member', method: 'human', note: '成员投稿' });
    return json(res, 200, { ok: true, id, note: '已提交，待审核' }, CORS);
  }

  const who = identify(req);
  if (!who) {
    if (req.url?.startsWith('/api/')) return json(res, 401, { error: '需要 token 或登录' });
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="admin"' });
    return res.end('需要登录');
  }

  const actor = who.role === 'agent' ? `agent:${who.user}` : who.user;

  // 页面
  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(page(actor));
  }

  // 兜底：非 API 的 GET 一律回后台页面（反代下打错路径也能落到界面）
  if (req.method === 'GET' && !url.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(page(actor));
  }

  // GET /api/scaffold?type=guide — 按类型返回内容骨架，agent 写稿用
  if (req.method === 'GET' && url.startsWith('/api/scaffold')) {
    const t = new URL('http://localhost' + url).searchParams.get('type') || 'guide';
    const today = new Date().toISOString().slice(0, 10);
    const SCAFFOLDS: Record<string, any> = {
      guide: {
        id: 'g??', type: 'guide', publishState: 'draft', title: '', summary: '', date: today,
        status: '草稿', people: [], tags: [], author: '',
        extra: {
          scene: '具体场景，带数字：周五 17:00 前要交…平均花 90 分钟…（不写「提高效率」这类空话）',
          path: ['第 1 步：用什么工具、点什么、说什么（共 4~6 步，每步能照做）'],
          prompt: '完整可复制的提示词。带硬性要求：禁止空话、保留数字、不确定标 [待补充]',
          pitfalls: ['真实容易踩的坑 ×3，不写「注意安全」这类废话'],
          usage: '谁用过、用了多久、效果如何，有数字。没有实测就写「尚未实测，[待补充]」',
        },
      },
      skill: {
        id: 's??', type: 'skill', publishState: 'draft', title: '', summary: '', date: today,
        status: '草稿', people: [], tags: [], author: '',
        extra: { command: '可直接复制给 agent 的指令正文，输出结构和禁止事项写清楚', appliesTo: 'Claude Code / Codex / Cursor' },
      },
      template: {
        id: 't??', type: 'template', publishState: 'draft', title: '', summary: '', date: today,
        status: '草稿', people: [], tags: [], author: '',
        extra: { downloadUrl: '/downloads/文件名.md（文件放 public/downloads/）' },
      },
      link: {
        id: 'l??', type: 'link', publishState: 'draft', title: '', summary: '', date: today,
        status: '外部', people: [], tags: [], author: '',
        extra: { url: 'https://…（外部项目无详情页）' },
      },
      training: {
        id: 'tr??', type: 'training', publishState: 'draft', title: '', summary: '', date: today,
        status: '报名中', people: [], tags: [], author: '',
        extra: { kind: 'notice', deadline: 'YYYY-MM-DD', materials: '地点 / 材料' },
      },
      project: { id: 'p??', type: 'project', publishState: 'draft', title: '', summary: '', date: today, status: '进行中', people: [], tags: [], author: '', extra: { deliverable: '产品 / 工具 / 素材包' } },
      competition: { id: 'k??', type: 'competition', publishState: 'draft', title: '', summary: '', date: today, status: '备赛中', people: [], tags: [], author: '', extra: { level: '国家级 / 省级 / 校级', team: '队伍情况' } },
      activity: { id: 'a??', type: 'activity', publishState: 'draft', title: '', summary: '', date: today, status: '已结束', people: [], tags: [], author: '', extra: { place: '地点', recap: '到场人数、产出（有数字）' } },
      course: { id: 'c??', type: 'course', publishState: 'draft', title: '', summary: '', date: today, status: '可学习', people: [], tags: [], author: '', extra: { difficulty: '入门 / 进阶', duration: '2 小时', outline: ['能照做的动作句 ×4'] } },
      video: { id: 'v??', type: 'video', publishState: 'draft', title: '', summary: '', date: today, status: '可观看', people: [], tags: [], author: '', extra: { provider: 'bilibili / mp4', embedUrl: '', duration: '0:00' } },
    };
    const sk = SCAFFOLDS[t];
    if (!sk) return json(res, 400, { error: 'unknown type', allowed: Object.keys(SCAFFOLDS) });
    return json(res, 200, {
      标准: '判断标准：一个没做过的人照着做完，能产出东西。完整样板见 content/items.json 的 g01',
      scaffold: sk,
    });
  }

  // GET /api/flags — 功能开关读取；PUT — 切换单个开关
  if (url === '/api/flags') {
    if (req.method === 'GET') return json(res, 200, readJson(FLAGS_FILE, []));
    if (req.method === 'PUT') {
      const p = JSON.parse((await body(req)) || '{}');
      const flags = readJson<any[]>(FLAGS_FILE, []);
      const f = flags.find((x) => x.key === p?.key);
      if (!f) return json(res, 400, { error: 'unknown key', allowed: flags.map((x) => x.key) });
      const prev = f.enabled;
      f.enabled = !!p.enabled;
      writeJson(FLAGS_FILE, flags);
      logTransition({ id: `flags:${p.key}`, from: prev, to: f.enabled, actor, method: who.role === 'agent' ? 'agent' : 'human', note: '功能开关切换' });
      return json(res, 200, { ok: true, key: p.key, enabled: f.enabled, note: '重新构建后生效' });
    }
    return json(res, 405, { error: 'method not allowed' });
  }

  // GET /api/tools — 工具目录读取；PUT — 整表替换（带校验）
  if (url === '/api/tools') {
    const KINDS = ['tool', 'api', 'internal'];
    const AUDIENCES = ['all', 'core', '技术部', '宣传部', '竞赛部', '创新创业部'];
    if (req.method === 'GET') return json(res, 200, readJson(TOOLS_FILE, []));
    if (req.method === 'PUT') {
      let list: any[];
      try {
        list = JSON.parse((await body(req)) || 'null');
      } catch {
        return json(res, 400, { error: 'bad json' });
      }
      if (!Array.isArray(list)) return json(res, 400, { error: 'body 必须是工具数组' });
      for (const [i, t] of list.entries()) {
        if (!t?.name || !t?.url || !KINDS.includes(t.kind) || !AUDIENCES.includes(t.audience) || !/^https?:\/\//.test(t.url)) {
          return json(res, 400, { error: `第 ${i} 条不合法`, 要求: 'name/url(http开头)/kind(tool|api|internal)/audience/desc 必填，audience 取 ' + AUDIENCES.join('|') });
        }
      }
      writeJson(TOOLS_FILE, list);
      logTransition({ id: 'tools', from: '-', to: `${list.length} 条`, actor, method: who.role === 'agent' ? 'agent' : 'human', note: '工具目录整表替换' });
      return json(res, 200, { ok: true, count: list.length, note: '重新构建后生效' });
    }
    return json(res, 405, { error: 'method not allowed' });
  }

  // GET /api/items
  if (req.method === 'GET' && url === '/api/items') {
    return json(res, 200, readItems().map((i) => ({ ...i, publishState: currentState(i.id) })));
  }

  // GET /api/items/:id
  const one = url.match(/^\/api\/items\/([\w-]+)$/);
  if (one && req.method === 'GET') {
    const item = readItems().find((i) => i.id === one[1]);
    if (!item) return json(res, 404, { error: '不存在' });
    return json(res, 200, { ...item, publishState: currentState(item.id) });
  }

  // PUT /api/items/:id 新建或更新
  if (one && req.method === 'PUT') {
    const id = one[1];
    let data: any;
    try {
      data = JSON.parse(await body(req));
    } catch {
      return json(res, 400, { error: 'body 不是合法 JSON' });
    }
    if (!data.title || !data.type) return json(res, 400, { error: '至少需要 title 和 type' });

    const list = readItems();
    const idx = list.findIndex((i) => i.id === id);
    const prev = idx >= 0 ? list[idx] : null;
    const next = {
      id,
      status: '待审核',
      publishState: 'draft',
      people: [],
      tags: [],
      ...prev,
      ...data,
      id,
      publishState: data.publishState ?? prev?.publishState ?? 'draft',
    };

    // 写入前校验：用与 pnpm test 同一套规则，坏内容不允许进库/进构建。
    // 用「写入后的完整列表」校验（成员↔内容引用需要全量才能判断），只拦截这条条目自身的 error。
    const candidate = idx >= 0 ? list.map((i, k) => (k === idx ? next : i)) : [...list, next];
    const errors = validateContent({ items: candidate as any, members: members as any }).filter(
      (issue) => issue.level === 'error' && issue.id === id
    );
    if (errors.length) {
      return json(res, 400, {
        error: '内容校验未通过，未写入',
        issues: errors.map((issue) => ({ code: issue.code, field: issue.field, message: issue.message })),
      });
    }

    writeItems(candidate);
    logTransition({
      id,
      from: prev ? 'update' : 'create',
      to: next.publishState,
      actor,
      method: who.role === 'agent' ? 'agent' : 'human',
    });
    return json(res, 200, { ok: true, id, created: !prev });
  }

  // DELETE /api/items/:id
  if (one && req.method === 'DELETE') {
    const list = readItems();
    const idx = list.findIndex((i) => i.id === one[1]);
    if (idx < 0) return json(res, 404, { error: '不存在' });
    list.splice(idx, 1);
    writeItems(list);
    logTransition({
      id: one[1],
      from: 'delete',
      to: 'deleted',
      actor,
      method: who.role === 'agent' ? 'agent' : 'human',
    });
    return json(res, 200, { ok: true });
  }

  // GET /api/submissions — 成员投稿列表（agent / 管理员）
  if (req.method === 'GET' && url === '/api/submissions') {
    return json(res, 200, readJson<any[]>(SUBMISSIONS_FILE, []));
  }

  // POST /api/submissions/:id/status — 投稿审核：published / rejected（可带 note）
  const subStatus = url.match(/^\/api\/submissions\/([\w-]+)\/status$/);
  if (subStatus && req.method === 'POST') {
    try {
      const { status, note } = JSON.parse((await body(req)) || '{}');
      if (!['published', 'rejected', 'pending'].includes(status)) throw new Error('状态不合法');
      const list = readJson<any[]>(SUBMISSIONS_FILE, []);
      const idx = list.findIndex((s) => s.id === subStatus[1]);
      if (idx < 0) throw new Error('投稿不存在：' + subStatus[1]);
      const prev = list[idx];
      list[idx] = {
        ...prev,
        status,
        note: note ? String(note).slice(0, 300) : prev.note,
        reviewedAt: new Date().toISOString(),
      };
      writeJson(SUBMISSIONS_FILE, list);
      logTransition({
        id: prev.id,
        from: prev.status,
        to: status,
        actor,
        method: who.role === 'agent' ? 'agent' : 'human',
        note: note || '',
      });
      return json(res, 200, { ok: true, id: prev.id, status });
    } catch (e: any) {
      return json(res, 400, { error: e.message });
    }
  }

  // GET /api/profiles — 成员 AI 档案；PUT — agent 写分析结果（整表替换）
  if (url === '/api/profiles') {
    if (req.method === 'GET') return json(res, 200, readJson<any[]>(PROFILES_FILE, []));
    if (req.method === 'PUT') {
      let list: any[];
      try {
        list = JSON.parse((await body(req)) || 'null');
      } catch {
        return json(res, 400, { error: 'bad json' });
      }
      if (!Array.isArray(list)) return json(res, 400, { error: 'body 必须是档案数组' });
      const bad = list.find(
        (p) => !members.some((m) => m.id === p?.memberId) || !String(p?.aiSummary || '').trim()
      );
      if (bad) return json(res, 400, { error: '每条档案必须有合法 memberId 和非空 aiSummary' });
      const today = new Date().toISOString().slice(0, 10);
      const normalized = list.map((p) => ({ ...p, aiUpdatedAt: today }));
      writeJson(PROFILES_FILE, normalized);
      logTransition({
        id: 'profiles',
        from: '-',
        to: `${normalized.length} 人`,
        actor,
        method: who.role === 'agent' ? 'agent' : 'human',
        note: 'AI 档案整表替换',
      });
      return json(res, 200, { ok: true, count: normalized.length, note: '重新构建后生效' });
    }
    return json(res, 405, { error: 'method not allowed' });
  }

  // POST /api/state
  if (req.method === 'POST' && url === '/api/state') {
    try {
      const { id, state, note } = JSON.parse((await body(req)) || '{}');
      if (!id || !STATES.includes(state)) throw new Error('参数不合法');
      // 用磁盘上的最新内容判断存在性：PUT 新建的条目也要能直接发布，不需要重启后台
      if (!readItems().some((i) => i.id === id)) throw new Error('内容不存在：' + id);
      setState(id, state, actor, who.role === 'agent' ? 'agent' : 'human', note || '');
      return json(res, 200, { ok: true, id, state });
    } catch (e: any) {
      return json(res, 400, { error: e.message });
    }
  }

  // POST /api/review — 完成复核：盖复核章并写 review-log（issue #13）
  if (req.method === 'POST' && url === '/api/review') {
    try {
      const { id } = JSON.parse((await body(req)) || '{}');
      const exists = readItems().some((i) => i.id === id) || items.some((i) => i.id === id);
      if (!id || !exists) throw new Error('内容不存在：' + (id || '(空)'));
      logTransition({ id, type: 'review', actor, method: who.role === 'agent' ? 'agent' : 'human' });
      return json(res, 200, { ok: true, id });
    } catch (e: any) {
      return json(res, 400, { error: e.message });
    }
  }

  // POST /api/build
  if (req.method === 'POST' && url === '/api/build') {
    json(res, 202, { ok: true, message: '构建已开始，结果看服务日志' });
    execFile('pnpm', ['build'], { cwd: ROOT }, (err, stdout, stderr) => {
      if (err) {
        console.error('[build] 失败', stderr || err.message);
        return;
      }
      console.log('[build] 完成', stdout.split('\n').filter(Boolean).pop());
      if (!DEPLOY_TARGET) return;
      execFile('rsync', ['-az', '--delete', '--chmod=D755,F644', 'dist/', DEPLOY_TARGET], { cwd: ROOT }, (err2) => {
        if (err2) console.error('[deploy] 失败', err2.message);
        else console.log('[deploy] 完成 →', DEPLOY_TARGET);
      });
    });
    return;
  }

  json(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`后台：http://127.0.0.1:${PORT}`);
  console.log(`  - 人：Basic Auth（ADMIN_USERS，默认 admin/admin123）`);
  console.log(`  - agent：Bearer token（${AGENT_TOKENS.length} 枚已配置${AGENT_TOKENS.length ? '：' + AGENT_TOKENS.map((t) => t.name).join('、') : '，未配置则 agent 接口关闭'}）`);
  console.log('  - 内容文件：content/items.json');
});

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
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { items } from '../src/data/items';
import { members } from '../src/data/members';
import { expiringSoon, validateContent } from '../src/data/validate';
import { SITE_BASE, sendIm, imChannel } from './im-push';
import { overdueReviews } from '../src/data/review';
import { voteLabel } from '../src/data/vote-labels';
import { analyzeMemberProfiles, analyzeWithLLM } from '../src/data/analyze';
import { validateSubmission } from '../src/data/contributions';
import {
  generateTempPassword,
  hashPassword,
  publicAccount,
  signSession,
  validateRegistration,
  verifyPassword,
  verifySession,
  type Account,
  type AdminLevel,
  type Dept,
  type Identity,
} from '../src/data/auth';

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

/** 成员账号与会话数据放在服务器本地（不入仓库，rsync 部署也不会覆盖） */
const DATA_DIR = process.env.DATA_DIR || join(homedir(), '.csust-maker-data');
mkdirSync(DATA_DIR, { recursive: true });
const ACCOUNTS_FILE = join(DATA_DIR, 'accounts.json');
const SESSION_SECRET_FILE = join(DATA_DIR, 'session-secret');
function loadSessionSecret(): string {
  try {
    return readFileSync(SESSION_SECRET_FILE, 'utf8').trim();
  } catch {
    const secret = randomBytes(32).toString('hex');
    writeFileSync(SESSION_SECRET_FILE, secret, { encoding: 'utf8', mode: 0o600 });
    return secret;
  }
}
const SESSION_SECRET = process.env.SESSION_SECRET || loadSessionSecret();
const SESSION_COOKIE = 'csust_session';
const ADMIN_COOKIE = 'csust_admin';
const ADMIN_LOG_FILE = join(DATA_DIR, 'admin-log.json');
const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || '';
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME || '超级管理员';
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

/** 根据投稿重新生成成员能力档案（发布投稿后自动跑一次） */
function regenerateProfiles(): number {
  const list = readJson<any[]>(SUBMISSIONS_FILE, []);
  const profiles = analyzeMemberProfiles(list as any, members);
  writeJson(PROFILES_FILE, profiles);
  return profiles.length;
}

/** 启动时检查：投稿文件比档案新（或档案缺失）就自动重算一次 */
function analyzeIfStale(): void {
  try {
    if (!existsSync(PROFILES_FILE)) {
      regenerateProfiles();
      console.log('[analyze] 档案不存在，已自动生成');
      return;
    }
    const subM = statSync(SUBMISSIONS_FILE).mtimeMs;
    const proM = statSync(PROFILES_FILE).mtimeMs;
    if (subM > proM + 1000) {
      const n = regenerateProfiles();
      console.log(`[analyze] 投稿比档案新，已自动重算 ${n} 位成员档案`);
    }
  } catch (e: any) {
    console.error('[analyze] 启动检查失败', e.message);
  }
}

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

/* ---------------------------- 成员账号 / 管理员会话 ---------------------------- */

function loadAccounts(): Account[] {
  return readJson<Account[]>(ACCOUNTS_FILE, []);
}
function saveAccounts(list: Account[]) {
  writeJson(ACCOUNTS_FILE, list);
}
function readCookies(req: http.IncomingMessage): Record<string, string> {
  const raw = String(req.headers.cookie || '');
  const out: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}
function isSecureRequest(req: http.IncomingMessage): boolean {
  return String(req.headers['x-forwarded-proto'] || '').includes('https') || Boolean(process.env.HTTPS);
}
function accountFromCookie(req: http.IncomingMessage, cookieName: string): Account | null {
  const token = readCookies(req)[cookieName];
  if (!token) return null;
  const payload = verifySession(token, SESSION_SECRET);
  if (!payload) return null;
  const account = loadAccounts().find((a) => a.id === payload.accountId);
  if (!account || account.status !== 'approved') return null;
  return account;
}
/** 普通成员会话 */
function sessionAccount(req: http.IncomingMessage): Account | null {
  return accountFromCookie(req, SESSION_COOKIE);
}
/** 管理员会话（审核管理员 / 超级管理员） */
function adminSession(req: http.IncomingMessage): Account | null {
  const account = accountFromCookie(req, ADMIN_COOKIE);
  return account && account.adminLevel ? account : null;
}
function issueSession(req: http.IncomingMessage, res: http.ServerResponse, account: Account, cookieName: string) {
  const token = signSession(account.id, SESSION_SECRET);
  const secure = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`);
}
function clearSession(res: http.ServerResponse, cookieName: string) {
  res.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** 管理员操作日志（存本地，不提交仓库） */
function adminLog(entry: Record<string, unknown>) {
  const list = readJson<any[]>(ADMIN_LOG_FILE, []);
  list.unshift({ ...entry, at: new Date().toISOString() });
  writeJson(ADMIN_LOG_FILE, list.slice(0, 500));
}

/** 启动时确保超级管理员存在（首次部署用 env 初始化） */
function bootstrapSuperAdmin(): void {
  try {
    const admins = loadAccounts().filter((a) => a.adminLevel === 'super' && a.status === 'approved');
    if (!SUPER_ADMIN_EMAIL) {
      if (!admins.length) console.warn('[manage] 未配置 SUPER_ADMIN_EMAIL，当前没有超级管理员；管理端无法登录');
      return;
    }
    const list = loadAccounts();
    const existing = list.find((a) => a.email === SUPER_ADMIN_EMAIL);
    if (existing) {
      let changed = false;
      if (existing.adminLevel !== 'super') { existing.adminLevel = 'super'; changed = true; }
      if (existing.status !== 'approved') { existing.status = 'approved'; changed = true; }
      if (changed) { saveAccounts(list); console.log('[manage] 已把', SUPER_ADMIN_EMAIL, '设为超级管理员'); }
      return;
    }
    if (!SUPER_ADMIN_PASSWORD) {
      console.warn('[manage] 还没有超级管理员：请配置 SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASSWORD 后重启一次');
      return;
    }
    list.push({
      id: 'a-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      email: SUPER_ADMIN_EMAIL,
      phone: process.env.SUPER_ADMIN_PHONE || '',
      realName: SUPER_ADMIN_NAME,
      dept: '其他',
      identity: 'other',
      status: 'approved',
      adminLevel: 'super',
      passwordHash: hashPassword(SUPER_ADMIN_PASSWORD),
      createdAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'system',
    });
    saveAccounts(list);
    console.log('[manage] 已创建超级管理员账号：', SUPER_ADMIN_EMAIL);
  } catch (e: any) {
    console.error('[manage] 超级管理员初始化失败', e.message);
  }
}

const loginHits = new Map<string, number[]>();
function allowLogin(ip: string): boolean {
  const now = Date.now();
  const hits = (loginHits.get(ip) || []).filter((x) => now - x < 10 * 60 * 1000);
  if (hits.length >= 12) return false;
  hits.push(now);
  loginHits.set(ip, hits);
  return true;
}
function clientIp(req: http.IncomingMessage): string {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
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
    ? `<div class="cfgbox"><b>成员投稿</b><span>共 ${subsNow.length} 条，待审核 ${pendingSubs.length} 条。发布后自动重算成员档案与成果墙；退回可写原因。</span><span class="ops" style="margin-left:auto"><button class="op" id="analyzeBtn">重算 AI 汇总</button></span>
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

  // 账号与权限：独立管理端
  const accountsNow = loadAccounts();
  const pendingAccounts = accountsNow.filter((a) => a.status === 'pending');
  const accountsHtml = `<div class="cfgbox"><b>账号与权限</b><span>共 ${accountsNow.length} 个账号，待审核 ${pendingAccounts.length} 个。<a href="/manage" target="_blank">打开独立管理端 /manage</a> → 审核实名资料、任命管理员、重置密码。</span></div>`;

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
  ${accountsHtml}
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
    <p><b>成员账号：</b><code>POST /api/auth/register</code>（邮箱/手机号 + 实名资料，待审核）· <code>POST /api/auth/login</code> · <code>POST /api/auth/logout</code> · <code>GET /api/auth/me</code> · <code>POST /api/auth/password</code> · <code>GET /api/my/submissions</code></p><p><b>管理端（/manage）：</b><code>POST /api/manage/login</code> · <code>GET /api/manage/overview</code> · <code>GET /api/manage/accounts</code> · <code>POST /api/manage/accounts/:id/review</code> · <code>POST /api/manage/accounts/:id/admin</code>（超级管理员任命）· <code>POST /api/manage/accounts/:id/reset-password</code> · <code>GET /api/manage/logs</code></p><p><b>成员成果平台：</b>登录后 <code>POST /api/contribute</code>（身份来自账号）；<code>GET /api/submissions</code> 投稿列表；<code>POST /api/submissions/:id/status</code> 审核；<code>POST /api/analyze</code> 重算 AI 汇总；<code>GET /api/profiles</code> / <code>PUT /api/profiles</code></p>
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

  // ---- 重新生成 AI 汇总 ----
  document.getElementById('analyzeBtn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    try {
      const r = await fetch('api/analyze', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '操作失败');
      toast('已重算 ' + d.count + ' 位成员档案（' + d.mode + '），重新构建后前台生效');
    } catch (err: any) {
      toast('失败：' + err.message);
    } finally {
      btn.disabled = false;
    }
  });

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

  // ---------- 成员账号：注册 / 登录 / 会话 / 我的投稿 ----------
  if (
    url === '/api/auth/register' ||
    url === '/api/auth/login' ||
    url === '/api/auth/logout' ||
    url === '/api/auth/me' ||
    url === '/api/auth/password' ||
    url.startsWith('/api/my/')
  ) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    if (url === '/api/auth/register' && req.method === 'POST') {
      const raw = await body(req);
      if (raw.length > 8192) return json(res, 413, { error: '内容过长' });
      let p: any;
      try {
        p = JSON.parse(raw);
      } catch {
        return json(res, 400, { error: 'bad json' });
      }
      const issues = validateRegistration(p);
      if (issues.length) return json(res, 400, { error: issues[0], issues });
      const email = String(p.email).trim().toLowerCase();
      const phone = String(p.phone).trim();
      const list = loadAccounts();
      if (list.some((a) => a.email === email && a.status !== 'rejected')) {
        return json(res, 409, { error: '这个邮箱已经注册过了，请联系管理员' });
      }
      if (list.some((a) => a.phone === phone && a.status !== 'rejected')) {
        return json(res, 409, { error: '这个手机号已经注册过了，请联系管理员' });
      }
      const identity = String(p.identity) as Identity;
      const needsDept = identity === 'dept_member' || identity === 'dept_lead';
      const account: Account = {
        id: 'a-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
        email,
        phone,
        realName: String(p.realName).trim(),
        dept: (needsDept ? String(p.dept) : '其他') as Dept,
        identity,
        status: 'pending',
        adminLevel: null,
        passwordHash: hashPassword(String(p.password)),
        createdAt: new Date().toISOString(),
      };
      const rejected = list.find((a) => a.email === email && a.status === 'rejected');
      if (rejected) Object.assign(rejected, { ...account, id: rejected.id, createdAt: rejected.createdAt });
      else list.push(account);
      saveAccounts(list);
      adminLog({ action: 'register', actor: account.realName, target: account.email, note: '提交注册' });
      return json(res, 200, { ok: true, status: 'pending', note: '注册已提交，等待管理员审核' });
    }

    if (url === '/api/auth/login' && req.method === 'POST') {
      const ip = clientIp(req);
      if (!allowLogin(ip)) return json(res, 429, { error: '尝试太频繁，请 10 分钟后再试' });
      const raw = await body(req);
      let p: any;
      try {
        p = JSON.parse(raw);
      } catch {
        return json(res, 400, { error: 'bad json' });
      }
      const identifier = String(p.identifier ?? p.email ?? p.phone ?? '').trim().toLowerCase();
      const list = loadAccounts();
      const account = list.find((a) => a.email === identifier || a.phone === identifier);
      if (!account || !verifyPassword(String(p.password ?? ''), account.passwordHash)) {
        return json(res, 401, { error: '邮箱/手机号或密码不正确' });
      }
      if (account.status === 'pending') return json(res, 403, { error: '账号还在审核中，请等管理员通过' });
      if (account.status === 'rejected') return json(res, 403, { error: '账号申请被退回：' + (account.rejectReason || '请联系管理员') });
      if (account.status !== 'approved') return json(res, 403, { error: '账号不可用，请联系管理员' });
      account.lastLoginAt = new Date().toISOString();
      saveAccounts(list);
      issueSession(req, res, account, SESSION_COOKIE);
      return json(res, 200, { ok: true, account: publicAccount(account) });
    }

    if (url === '/api/auth/logout' && req.method === 'POST') {
      clearSession(res, SESSION_COOKIE);
      return json(res, 200, { ok: true });
    }

    const account = sessionAccount(req);
    if (url === '/api/auth/me') {
      if (!account) return json(res, 401, { error: '未登录' });
      return json(res, 200, { account: publicAccount(account) });
    }
    if (!account) return json(res, 401, { error: '请先登录', login: '/login' });

    if (url === '/api/auth/password' && req.method === 'POST') {
      const raw = await body(req);
      let p: any;
      try {
        p = JSON.parse(raw);
      } catch {
        return json(res, 400, { error: 'bad json' });
      }
      if (!verifyPassword(String(p.oldPassword ?? ''), account.passwordHash)) return json(res, 400, { error: '原密码不正确' });
      const pwIssues = validateRegistration({
        email: account.email,
        phone: account.phone,
        realName: account.realName,
        identity: account.identity,
        dept: account.dept,
        password: p.newPassword,
      }).filter((i) => i.includes('密码'));
      if (pwIssues.length) return json(res, 400, { error: pwIssues[0] });
      const list = loadAccounts();
      const target = list.find((a) => a.id === account.id)!;
      target.passwordHash = hashPassword(String(p.newPassword));
      saveAccounts(list);
      return json(res, 200, { ok: true, note: '密码已更新' });
    }

    if (url === '/api/my/submissions' && req.method === 'GET') {
      const list = readJson<any[]>(SUBMISSIONS_FILE, []).filter((s) => s.memberId === account.id);
      return json(res, 200, list);
    }

    const mySub = url.match(/^\/api\/my\/submissions\/([\w-]+)$/);
    if (mySub && req.method === 'POST') {
      const raw = await body(req);
      let p: any;
      try {
        p = JSON.parse(raw);
      } catch {
        return json(res, 400, { error: 'bad json' });
      }
      const list = readJson<any[]>(SUBMISSIONS_FILE, []);
      const idx = list.findIndex((s) => s.id === mySub[1] && s.memberId === account.id);
      if (idx < 0) return json(res, 404, { error: '记录不存在' });
      const prev = list[idx];
      if (!['pending', 'rejected'].includes(prev.status)) return json(res, 400, { error: '已发布的记录不能修改，请联系管理员' });
      if (p.action === 'withdraw') {
        list.splice(idx, 1);
        writeJson(SUBMISSIONS_FILE, list);
        return json(res, 200, { ok: true, note: '已撤回' });
      }
      const candidate = {
        ...prev,
        type: p.type ?? prev.type,
        title: p.title ?? prev.title,
        date: p.date ?? prev.date,
        description: p.description ?? prev.description,
        outcome: p.outcome ?? prev.outcome,
        link: p.link ?? prev.link,
        image: p.image ?? prev.image,
        evidence: p.evidence ?? prev.evidence,
        memberId: account.id,
      };
      const issues = validateSubmission(candidate, new Date(), { skipMember: true });
      if (issues.length) return json(res, 400, { error: '修改未通过校验', issues });
      list[idx] = { ...candidate, status: 'pending', submittedAt: new Date().toISOString(), note: undefined };
      writeJson(SUBMISSIONS_FILE, list);
      return json(res, 200, { ok: true, note: '已修改，重新进入待审核' });
    }

    return json(res, 404, { error: 'not found' });
  }

  // ---------- 管理端：账号审核 / 管理员任命 ----------
  if (url.startsWith('/api/manage/')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    if (url === '/api/manage/login' && req.method === 'POST') {
      const ip = clientIp(req);
      if (!allowLogin(ip)) return json(res, 429, { error: '尝试太频繁，请 10 分钟后再试' });
      const raw = await body(req);
      let p: any;
      try {
        p = JSON.parse(raw);
      } catch {
        return json(res, 400, { error: 'bad json' });
      }
      const identifier = String(p.identifier ?? '').trim().toLowerCase();
      const list = loadAccounts();
      const account = list.find((a) => a.email === identifier || a.phone === identifier);
      if (!account || !verifyPassword(String(p.password ?? ''), account.passwordHash)) {
        return json(res, 401, { error: '邮箱/手机号或密码不正确' });
      }
      if (account.status !== 'approved') return json(res, 403, { error: '账号未通过审核或已停用' });
      if (!account.adminLevel) return json(res, 403, { error: '不是管理员账号' });
      account.lastLoginAt = new Date().toISOString();
      saveAccounts(list);
      issueSession(req, res, account, ADMIN_COOKIE);
      return json(res, 200, { ok: true, account: publicAccount(account) });
    }

    if (url === '/api/manage/logout' && req.method === 'POST') {
      clearSession(res, ADMIN_COOKIE);
      return json(res, 200, { ok: true });
    }

    const admin = adminSession(req);
    if (!admin) return json(res, 401, { error: '需要管理员登录', login: '/manage' });
    const isSuper = admin.adminLevel === 'super';

    if (url === '/api/manage/me') {
      return json(res, 200, { account: publicAccount(admin) });
    }

    if (url === '/api/manage/overview' && req.method === 'GET') {
      const list = loadAccounts();
      return json(res, 200, {
        counts: {
          total: list.length,
          pending: list.filter((a) => a.status === 'pending').length,
          approved: list.filter((a) => a.status === 'approved').length,
          admins: list.filter((a) => a.adminLevel && a.status === 'approved').length,
        },
        pending: list
          .filter((a) => a.status === 'pending')
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .map(publicAccount),
        me: publicAccount(admin),
      });
    }

    if (url.startsWith('/api/manage/accounts') && req.method === 'GET') {
      const q = new URL('http://localhost' + url).searchParams;
      const status = q.get('status') || '';
      const kw = (q.get('q') || '').trim().toLowerCase();
      let list = loadAccounts().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      if (status) list = list.filter((a) => a.status === status);
      if (kw) list = list.filter((a) => [a.realName, a.email, a.phone, a.dept].join(' ').toLowerCase().includes(kw));
      return json(res, 200, list.map(publicAccount));
    }

    const accReview = url.match(/^\/api\/manage\/accounts\/([\w-]+)\/review$/);
    if (accReview && req.method === 'POST') {
      const bodyData = JSON.parse((await body(req)) || '{}');
      const list = loadAccounts();
      const target = list.find((a) => a.id === accReview[1]);
      if (!target) return json(res, 404, { error: '账号不存在' });
      if (bodyData.action === 'reject') {
        target.status = 'rejected';
        target.rejectReason = String(bodyData.reason || '').slice(0, 200);
        target.reviewedAt = new Date().toISOString();
        target.reviewedBy = admin.realName;
        saveAccounts(list);
        adminLog({ action: 'reject', actor: admin.realName, target: target.email, note: target.rejectReason });
        return json(res, 200, { ok: true, account: publicAccount(target) });
      }
      if (bodyData.action !== 'approve') return json(res, 400, { error: '操作不合法' });
      target.status = 'approved';
      if (bodyData.identity) target.identity = String(bodyData.identity) as Identity;
      if (bodyData.dept) target.dept = String(bodyData.dept) as Dept;
      target.reviewedAt = new Date().toISOString();
      target.reviewedBy = admin.realName;
      this_clean: {
        // 部门成员/部长必须有具体部门
        if ((target.identity === 'dept_member' || target.identity === 'dept_lead') && target.dept === '其他') {
          return json(res, 400, { error: '请为部门成员/部长选择具体部门' });
        }
        break this_clean;
      }
      saveAccounts(list);
      adminLog({ action: 'approve', actor: admin.realName, target: target.email, note: '通过' });
      return json(res, 200, { ok: true, account: publicAccount(target) });
    }

    const accAdmin = url.match(/^\/api\/manage\/accounts\/([\w-]+)\/admin$/);
    if (accAdmin && req.method === 'POST') {
      if (!isSuper) return json(res, 403, { error: '只有超级管理员可以任命管理员' });
      const bodyData = JSON.parse((await body(req)) || '{}');
      const list = loadAccounts();
      const target = list.find((a) => a.id === accAdmin[1]);
      if (!target) return json(res, 404, { error: '账号不存在' });
      if (target.status !== 'approved') return json(res, 400, { error: '账号未通过审核，不能设为管理员' });
      const level = bodyData.adminLevel;
      if (![null, undefined, 'reviewer', 'super'].includes(level)) return json(res, 400, { error: '管理员等级不合法' });
      if (target.id === admin.id && level !== 'super') return json(res, 400, { error: '不能取消自己的超级管理员权限' });
      target.adminLevel = level || null;
      saveAccounts(list);
      adminLog({ action: 'appoint', actor: admin.realName, target: target.email, note: target.adminLevel || '取消管理员' });
      return json(res, 200, { ok: true, account: publicAccount(target) });
    }

    const accReset = url.match(/^\/api\/manage\/accounts\/([\w-]+)\/reset-password$/);
    if (accReset && req.method === 'POST') {
      const list = loadAccounts();
      const target = list.find((a) => a.id === accReset[1]);
      if (!target) return json(res, 404, { error: '账号不存在' });
      const password = generateTempPassword();
      target.passwordHash = hashPassword(password);
      saveAccounts(list);
      adminLog({ action: 'reset-password', actor: admin.realName, target: target.email });
      return json(res, 200, { ok: true, password, note: '临时密码只显示这一次' });
    }

    const accStatus = url.match(/^\/api\/manage\/accounts\/([\w-]+)\/status$/);
    if (accStatus && req.method === 'POST') {
      if (!isSuper) return json(res, 403, { error: '只有超级管理员可以停用/恢复账号' });
      const bodyData = JSON.parse((await body(req)) || '{}');
      if (!['approved', 'disabled'].includes(bodyData.status)) return json(res, 400, { error: '状态不合法' });
      const list = loadAccounts();
      const target = list.find((a) => a.id === accStatus[1]);
      if (!target) return json(res, 404, { error: '账号不存在' });
      if (target.id === admin.id) return json(res, 400, { error: '不能停用自己的账号' });
      target.status = bodyData.status;
      saveAccounts(list);
      adminLog({ action: bodyData.status === 'disabled' ? 'disable' : 'enable', actor: admin.realName, target: target.email });
      return json(res, 200, { ok: true, account: publicAccount(target) });
    }

    if (url === '/api/manage/logs' && req.method === 'GET') {
      return json(res, 200, readJson<any[]>(ADMIN_LOG_FILE, []).slice(0, 200));
    }

    return json(res, 404, { error: 'not found' });
  }

  // ---------- 公开接口：成员成果投稿  // ---------- 公开接口：成员成果投稿（成员自己填写，待审核） ----------
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
    const session = sessionAccount(req);
    if (!session) return json(res, 401, { error: '请先登录后再提交记录', login: '/login' }, CORS);
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
    const member = { id: session.id, name: session.realName, dept: session.dept };
    const issues = validateSubmission({ ...p, memberId: session.id }, new Date(), { skipMember: true });
    if (issues.length) return json(res, 400, { error: '提交未通过校验', issues }, CORS);
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
    logTransition({ id, from: '-', to: 'pending', actor: session.realName, method: 'human', note: '成员投稿（登录账号）' });
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
      // 自动化：发布后立即重算成员能力档案（前台重新构建后生效）
      if (status === 'published') {
        try {
          const n = regenerateProfiles();
          console.log(`[analyze] 投稿 ${prev.id} 发布，已重算 ${n} 位成员档案`);
        } catch (e: any) {
          console.error('[analyze] 重算失败', e.message);
        }
      }
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

  // POST /api/analyze — 立即重算成员能力档案（配置 AI_API_KEY 时走 LLM）
  if (url === '/api/analyze' && req.method === 'POST') {
    try {
      const list = readJson<any[]>(SUBMISSIONS_FILE, []);
      const profiles = await analyzeWithLLM(list as any, members);
      writeJson(PROFILES_FILE, profiles);
      logTransition({ id: 'profiles', from: '-', to: `${profiles.length} 人`, actor, method: who.role === 'agent' ? 'agent' : 'human', note: 'AI 汇总自动重算' });
      return json(res, 200, {
        ok: true,
        count: profiles.length,
        mode: process.env.AI_API_KEY && process.env.AI_BASE_URL ? 'llm' : 'rules',
        note: '重新构建后前台生效',
      });
    } catch (e: any) {
      return json(res, 500, { error: e.message });
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
  analyzeIfStale();
  bootstrapSuperAdmin();
  console.log(`后台：http://127.0.0.1:${PORT}`);
  console.log(`  - 人：Basic Auth（ADMIN_USERS，默认 admin/admin123）`);
  console.log(`  - agent：Bearer token（${AGENT_TOKENS.length} 枚已配置${AGENT_TOKENS.length ? '：' + AGENT_TOKENS.map((t) => t.name).join('、') : '，未配置则 agent 接口关闭'}）`);
  console.log('  - 内容文件：content/items.json');
});

#!/usr/bin/env tsx
/**
 * 每日运营简报（issue #14）。
 *
 * 每天 03:30 定时构建（csust-build-daily.timer）成功后由 systemd ExecStartPost 调起，
 * 向管理员 IM 推一条运营简报，复用 issue #10 的推送通道（scripts/im-push.ts）：
 *   1. 新增反馈：过去 24 小时的反馈，含 confirmed（照做）与留言摘要
 *   2. 浏览 Top3：metrics.json 浏览量排序前 3（存量排行——views 没有逐次时间戳，无法算"新增"）
 *   3. 即将到期：14 天内到期的已发布内容（src/data/validate 的 expiringSoon）
 *
 * 取数决策（有意为之，不做可配置）：
 *   - "新增反馈"按 24 小时时间窗近似"距上次简报以来"：简报每天固定跑一次，
 *     窗口自然对齐；metrics.json 只存逐条反馈带 at 时间戳，够用。
 *   - 无新动态（24h 无新反馈且无即将到期）时也推极简一条（日期 + 零增长说明）：
 *     简报的价值在于"每天有固定出口"，一条空简报能确认链路没坏、确实没有动态；
 *     沉默反而分不清"没动态"和"简报挂了"。
 *
 * 数据：metrics.json 与 content/items.json 由线上服务器持有（gitignore），
 * 本地没有时按空数据 / 静态兜底处理。未配置推送通道时 dry-run 记日志、不报错。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { items, type Item, type PublishState } from '../src/data/items';
import { expiringSoon } from '../src/data/validate';
import { SITE_BASE, sendIm } from './im-push';

const ROOT = process.cwd();
const METRICS_FILE = join(ROOT, 'metrics.json');
const CONTENT_FILE = join(ROOT, 'content/items.json');
const OVERRIDES_FILE = join(ROOT, 'src/data/publish-state.json');
/** 反馈时间窗：距上次简报 24 小时 */
const WINDOW_HOURS = 24;
const EXPIRE_DAYS = 14;

type MetricsFile = {
  views: Record<string, number>;
  feedback: { item: string; vote: 'useful' | 'useless' | 'confirmed'; note?: string; at: string }[];
  updatedAt?: string;
};

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function readMetrics(): MetricsFile {
  return readJson<MetricsFile>(METRICS_FILE, { views: {}, feedback: [] });
}

/** 线上实时内容：content/items.json 优先，缺了退回静态数据；两种来源都套 publish-state.json 覆盖 */
function readItems(): Item[] {
  const live = readJson<any[]>(CONTENT_FILE, []);
  const overrides = readJson<Record<string, PublishState>>(OVERRIDES_FILE, {});
  const base = live.length ? (live as Item[]) : items;
  return base.map((i) => ({ ...i, publishState: overrides[i.id] ?? i.publishState }));
}

const voteLabel = { useful: '有用', useless: '没用', confirmed: '照做' } as const;

/** 详情页链接；外部项目（link）无详情页，直达其外链 */
function itemLink(it: Item | undefined, id: string): string {
  return it?.type === 'link' && it.extra?.url ? it.extra.url : `${SITE_BASE}/library/${id}`;
}

function fmtDate(iso: string): string {
  return iso.slice(5, 10); // MM-DD
}

export function buildBrief(metrics: MetricsFile, live: Item[], now = new Date()) {
  const cutoff = new Date(now.getTime() - WINDOW_HOURS * 3600 * 1000);
  const newFeedback = metrics.feedback
    .filter((f) => new Date(f.at) >= cutoff)
    .sort((a, b) => (a.at < b.at ? -1 : 1));
  const top3 = Object.entries(metrics.views)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([id, count]) => ({ id, count, item: live.find((i) => i.id === id) }));
  const expiring = expiringSoon(live, EXPIRE_DAYS);
  return { newFeedback, top3, expiring };
}

async function main() {
  const metrics = readMetrics();
  const live = readItems();
  const { newFeedback, top3, expiring } = buildBrief(metrics, live);
  const today = new Date().toISOString().slice(0, 10);

  // 无新动态：24h 无新增反馈 且 无即将到期。浏览 Top3 是存量排行，不参与"有无动态"判定。
  if (newFeedback.length === 0 && expiring.length === 0) {
    await sendIm({
      header: `📋 每日简报 ${today}`,
      body: `过去 ${WINDOW_HOURS} 小时无新增反馈，无即将到期内容。`,
    }, 'daily-brief');
    return;
  }

  const sections: string[] = [];

  sections.push(
    `**新增反馈**（过去 ${WINDOW_HOURS} 小时 ${newFeedback.length} 条）\n` +
      (newFeedback.length
        ? newFeedback
            .map((f) => {
              const it = live.find((i) => i.id === f.item);
              const note = f.note ? ` · 「${f.note.slice(0, 60)}」` : '';
              return `- [${it?.title ?? f.item}](${itemLink(it, f.item)}) ${voteLabel[f.vote] ?? f.vote}${note} · ${fmtDate(f.at)}`;
            })
            .join('\n')
        : '无')
  );

  sections.push(
    `**浏览 Top3**\n` +
      (top3.length
        ? top3
            .map((t, i) => `${i + 1}. [${t.item?.title ?? t.id}](${itemLink(t.item, t.id)}) — ${t.count} 次`)
            .join('\n')
        : '暂无浏览数据')
  );

  sections.push(
    `**即将到期**（${EXPIRE_DAYS} 天内 ${expiring.length} 条）\n` +
      (expiring.length
        ? expiring
            .map((i) => {
              const days = Math.ceil((new Date(i.expiresAt + 'T23:59:59').getTime() - Date.now()) / 864e5);
              return `- [${i.title}](${itemLink(i, i.id)}) — ${i.expiresAt} 截止（剩 ${days} 天）`;
            })
            .join('\n')
        : '无')
  );

  await sendIm({
    header: `📋 每日简报 ${today}`,
    body: sections.join('\n\n'),
    buttons: [{ text: '打开数据页', url: `${SITE_BASE}/stats` }],
  }, 'daily-brief');
}

main().catch((e) => {
  console.error('[daily-brief] 执行失败', e?.message || e);
  process.exit(1);
});

/**
 * 90 天复核机制（issue #13）。
 *
 * 复核事实源是 review-log.json：条目的「最近复核时间」取该条目最近一条
 * type:'review'（完成复核）或 to:'published'（发布即盖复核章）记录的 at。
 * 已发布且最近复核距今超过阈值（REVIEW_DAYS，默认 90 天）的条目进入「待复核」清单。
 * 纯数据逻辑，便于 vitest 用构造数据测试；admin-server 负责读写文件与端点。
 */

export type ReviewLogEntry = {
  id: string;
  type?: string;
  to?: string;
  at: string;
  [key: string]: unknown;
};

export const DEFAULT_REVIEW_DAYS = 90;

/** 条目最近一次复核时间（发布也算盖上复核章）；无记录返回 null */
export function lastReviewAt(log: ReviewLogEntry[], id: string): string | null {
  let latest: string | null = null;
  for (const e of log) {
    if (e?.id !== id) continue;
    if (e.type !== 'review' && e.to !== 'published') continue;
    if (!latest || e.at > latest) latest = e.at;
  }
  return latest;
}

/** 已发布且超龄未复核的条目（无复核记录视为超龄），按最近复核时间从旧到新排 */
export function overdueReviews(
  items: { id: string; title?: string; publishState?: string }[],
  log: ReviewLogEntry[],
  now: Date = new Date(),
  days: number = DEFAULT_REVIEW_DAYS
): { id: string; title: string; lastReviewAt: string | null }[] {
  const out: { id: string; title: string; lastReviewAt: string | null }[] = [];
  for (const i of items) {
    if (i.publishState !== 'published') continue;
    const at = lastReviewAt(log, i.id);
    if (at && (now.getTime() - new Date(at).getTime()) / 864e5 <= days) continue;
    out.push({ id: i.id, title: i.title ?? i.id, lastReviewAt: at });
  }
  return out.sort((a, b) => (a.lastReviewAt ?? '').localeCompare(b.lastReviewAt ?? ''));
}

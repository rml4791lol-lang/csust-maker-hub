#!/usr/bin/env tsx
/**
 * 回填成员成果投稿：把内容库（content/items.json）里已有的、带参与人的条目
 * 回填成「成员成果」记录（source=backfill，status=published），让每位成员一开始就有时间线。
 * 幂等：已存在的回填记录不会重复添加。
 *
 * 用法：pnpm backfill
 * 档案生成不在这里做：跑完 `pnpm analyze`（或后台发布投稿时自动触发）。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { items } from '../src/data/items';
import { members } from '../src/data/members';
import { publishedItems } from '../src/data/validate';
import type { ContributionType, Submission } from '../src/data/contributions';

const ROOT = process.cwd();
const SUB_PATH = join(ROOT, 'content/submissions.json');

const TYPE_BY_ITEM: Record<string, ContributionType> = {
  guide: 'practice',
  skill: 'practice',
  template: 'practice',
  link: 'practice',
  training: 'talk',
  project: 'project',
  competition: 'competition',
  activity: 'talk',
  course: 'course',
  video: 'talk',
};

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

const existing = readJson<Submission[]>(SUB_PATH, []);
const byId = new Map(existing.map((s) => [s.id, s]));
const live = publishedItems(items);

for (const item of live) {
  for (const person of item.people ?? []) {
    const member = members.find((m) => m.name === person);
    if (!member) continue;
    const id = `bk-${item.id}-${member.id}`;
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      memberId: member.id,
      memberName: member.name,
      dept: member.dept,
      type: TYPE_BY_ITEM[item.type] ?? 'other',
      title: item.title,
      date: item.date,
      description: item.summary,
      link: `/library/${item.id}`,
      status: 'published',
      submittedAt: `${item.date}T00:00:00.000Z`,
      source: 'backfill',
    });
  }
}

const submissions = [...byId.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
writeFileSync(SUB_PATH, JSON.stringify(submissions, null, 2) + '\n', 'utf8');
console.log(`回填完成：投稿 ${submissions.length} 条（已发布 ${submissions.filter((s) => s.status === 'published').length}）`);
console.log('下一步：pnpm analyze 重新生成成员能力档案');

#!/usr/bin/env tsx
/**
 * 回填成员成果投稿 + 重算成员档案统计。
 *
 * 用途：
 *  1. 把内容库（content/items.json）里已有的、带参与人的条目回填成「成员成果」投稿记录，
 *     让每个成员一开始就有可看的档案时间线（source=backfill，status=published）。
 *  2. 按成员重算 profiles.json 里的统计字段（投稿数 / 参与项目 / 攻略数 / 首末日期），
 *     **保留 agent 写入的 AI 汇总文本**（aiSummary / focusTags / highlights / nextStep）。
 *
 * 用法：pnpm backfill
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { items } from '../src/data/items';
import { members } from '../src/data/members';
import { publishedItems } from '../src/data/validate';
import type { ContributionType, MemberProfile, Submission } from '../src/data/contributions';

const ROOT = process.cwd();
const SUB_PATH = join(ROOT, 'content/submissions.json');
const PRO_PATH = join(ROOT, 'content/profiles.json');

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
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

const today = new Date().toISOString().slice(0, 10);
const existingSubs = readJson<Submission[]>(SUB_PATH, []);
const existingProfiles = readJson<MemberProfile[]>(PRO_PATH, []);
const subById = new Map(existingSubs.map((s) => [s.id, s]));
const live = publishedItems(items);

// ---------- 1. 回填投稿 ----------
for (const item of live) {
  for (const person of item.people ?? []) {
    const member = members.find((m) => m.name === person);
    if (!member) continue;
    const id = `bk-${item.id}-${member.id}`;
    if (subById.has(id)) continue;
    subById.set(id, {
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

const submissions = [...subById.values()].sort((a, b) => (a.date < b.date ? 1 : -1));

// ---------- 2. 重算档案统计（保留 AI 文本） ----------
const published = submissions.filter((s) => s.status === 'published');
const oldProfileById = new Map(existingProfiles.map((p) => [p.memberId, p]));

const profiles: MemberProfile[] = members.map((m) => {
  const own = published.filter((s) => s.memberId === m.id);
  const ownItems = live.filter((i) => (i.people ?? []).includes(m.name));
  const old = oldProfileById.get(m.id);
  const dates = [...own.map((s) => s.date), ...ownItems.map((i) => i.date)].sort();
  return {
    memberId: m.id,
    name: m.name,
    dept: m.dept,
    role: m.role,
    grade: m.grade,
    aiSummary:
      old?.aiSummary ??
      `${m.dept}成员${m.role ? `（${m.role}）` : ''}，参与 ${ownItems.length} 条内容记录。`,
    focusTags: old?.focusTags ?? m.skills.slice(0, 3),
    highlights:
      old?.highlights ??
      own.slice(0, 3).map((s) => `${s.title}（${s.date}）`),
    nextStep: old?.nextStep,
    stats: {
      contributions: own.length,
      projects: ownItems.filter((i) => i.type === 'project').length,
      guides: ownItems.filter((i) => i.type === 'guide').length,
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
    },
    aiUpdatedAt: old?.aiUpdatedAt ?? today,
  };
});

writeFileSync(SUB_PATH, JSON.stringify(submissions, null, 2) + '\n', 'utf8');
writeFileSync(PRO_PATH, JSON.stringify(profiles, null, 2) + '\n', 'utf8');

console.log(`投稿：${submissions.length} 条（已发布 ${published.length}）`);
console.log(`档案：${profiles.length} 人`);
console.log('已写入 content/submissions.json 与 content/profiles.json');

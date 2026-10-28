import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { activities, sortedActivities, activityKindLabel } from '../src/data/activities';
import { depts } from '../src/data/members';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const local = (url: string) => join(publicDir, url.replace(/^\//, ''));

describe('协会活动数据（照片接入防 404）', () => {
  it('活动数量与必填字段完整', () => {
    expect(activities.length).toBeGreaterThanOrEqual(4);
    const ids = new Set(activities.map((a) => a.id));
    expect(ids.size).toBe(activities.length);
    for (const a of activities) {
      expect(a.title.length).toBeGreaterThan(2);
      expect(a.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.summary.length).toBeGreaterThan(10);
      expect(a.cover.startsWith('/')).toBe(true);
      expect(activityKindLabel[a.kind]).toBeTruthy();
    }
  });

  it('活动封面与现场照片都已放进 public/photos', () => {
    const missing: string[] = [];
    for (const a of activities) {
      for (const src of [a.cover, ...(a.photos ?? [])]) {
        if (!existsSync(local(src))) missing.push(src);
      }
    }
    expect(missing).toEqual([]);
  });

  it('活动部门归属都在协会部门列表里', () => {
    const bad = activities.flatMap((a) => (a.depts ?? []).filter((d) => !depts.includes(d)));
    expect(bad).toEqual([]);
  });

  it('按时间倒序', () => {
    const dates = sortedActivities().map((a) => a.date);
    expect([...dates].sort((x, y) => (x < y ? 1 : -1))).toEqual(dates);
  });
});

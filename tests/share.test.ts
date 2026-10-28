import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { members } from '../src/data/members';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shareDir = join(root, 'public', 'share');

describe('分享卡片（og:image）', () => {
  it('首页分享图存在且是 1200×630 JPEG', () => {
    const p = join(shareDir, 'home.jpg');
    expect(existsSync(p)).toBe(true);
    expect(statSync(p).size).toBeGreaterThan(20 * 1024);
    expect(readFileSync(p).subarray(0, 2).toString('hex')).toBe('ffd8');
  });

  it('每位成员都有分享图', () => {
    const missing = members.filter((m) => !existsSync(join(shareDir, `member-${m.id}.jpg`)));
    expect(missing.map((m) => m.id)).toEqual([]);
  });
});

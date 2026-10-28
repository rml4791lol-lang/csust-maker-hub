import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { items } from '../src/data/items';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const localPath = (url: string) => join(publicDir, url.replace(/^\//, ''));

describe('可下载文件（防 404 回归）', () => {
  it('模板类内容引用的本地下载文件存在', () => {
    const missing = items
      .filter((i) => i.type === 'template')
      .map((i) => i.extra?.downloadUrl)
      .filter((u): u is string => Boolean(u && u.startsWith('/')))
      .filter((u) => !existsSync(localPath(u)));
    expect(missing).toEqual([]);
  });

  it('public/downloads 里的模板文件可读', () => {
    const dir = join(publicDir, 'downloads');
    expect(existsSync(dir)).toBe(true);
    expect(readFileSync(join(dir, 'demand-form.md'), 'utf8').length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { items } from '../src/data/items';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');

const localPath = (url: string) => join(publicDir, url.replace(/^\//, ''));

describe('可下载文件（防 404 回归）', () => {
  it('模板条目的 downloadUrl 指向的文件存在', () => {
    const missing = items
      .filter((i) => i.type === 'template')
      .map((i) => i.extra?.downloadUrl)
      .filter((u): u is string => Boolean(u && u.startsWith('/')))
      .filter((u) => !existsSync(localPath(u)));
    expect(missing).toEqual([]);
  });

  it('资源页列出的下载文件都存在', () => {
    const src = readFileSync(join(root, 'src/pages/resources.astro'), 'utf8');
    const files = [...src.matchAll(/file:\s*'(\/[^']+)'/g)].map((m) => m[1]);
    expect(files.length).toBeGreaterThan(0);
    const missing = files.filter((u) => !existsSync(localPath(u)));
    expect(missing).toEqual([]);
  });
});

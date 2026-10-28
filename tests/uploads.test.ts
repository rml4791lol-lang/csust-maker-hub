import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canDirectUpload, approvedUploads, pendingUploads, uploads, uploadsByActivity } from '../src/data/uploads';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('现场相册：上传与可见性规则', () => {
  it('部长及以上直接发布；普通成员/其他需要审核', () => {
    expect(canDirectUpload('dept_lead')).toBe(true);
    expect(canDirectUpload('vice_president')).toBe(true);
    expect(canDirectUpload('president')).toBe(true);
    expect(canDirectUpload('teacher')).toBe(true);
    expect(canDirectUpload('partner')).toBe(true);
    expect(canDirectUpload('dept_member')).toBe(false);
    expect(canDirectUpload('other')).toBe(false);
  });

  it('只有审核通过的照片对外展示，并按时间倒序', () => {
    const list = [
      { id: 'a', url: '/a.jpg', uploaderId: '1', uploaderName: 'A', uploaderIdentity: 'dept_lead' as const, status: 'approved' as const, createdAt: '2026-10-01T00:00:00Z' },
      { id: 'b', url: '/b.jpg', uploaderId: '2', uploaderName: 'B', uploaderIdentity: 'dept_member' as const, status: 'pending' as const, createdAt: '2026-10-02T00:00:00Z' },
      { id: 'c', url: '/c.jpg', uploaderId: '3', uploaderName: 'C', uploaderIdentity: 'dept_lead' as const, status: 'approved' as const, createdAt: '2026-10-03T00:00:00Z' },
    ];
    expect(approvedUploads(list as any).map((u) => u.id)).toEqual(['c', 'a']);
    expect(pendingUploads(list as any).map((u) => u.id)).toEqual(['b']);
    expect(uploadsByActivity('x', list as any)).toEqual([]);
  });

  it('仓库里的相册照片文件都存在（防 404）', () => {
    const missing = uploads.filter((u) => u.url.startsWith('/') && !existsSync(join(root, 'public', u.url))).map((u) => u.url);
    expect(missing).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { validateContent, validateCurrentContent, publishedItems, isExpired } from '../src/data/validate';
import { lastReviewAt, overdueReviews } from '../src/data/review';
import type { Item } from '../src/data/items';
import type { Member } from '../src/data/members';

const baseItem = (over: Partial<Item> = {}): Item => ({
  id: 'x1',
  type: 'project',
  publishState: 'published',
  title: '示例',
  summary: '一句话',
  date: '2026-10-01',
  status: '已上线',
  people: [],
  tags: [],
  ...over,
});

const baseMember = (over: Partial<Member> = {}): Member => ({
  id: 'm9',
  name: '测试员',
  dept: '技术部',
  grade: '2024 级',
  skills: [],
  projects: [],
  ...over,
});

describe('内容校验', () => {
  it('仓库现有内容无 error 级问题', () => {
    // 基线从 toEqual([])（全部问题为空）放宽为只断言 error 级：#9 起 warn 级
    // 缺作者条目合法存在，warn 不阻塞，这里只兜住会挡发布的 error。
    expect(validateCurrentContent().filter((i) => i.level === 'error')).toEqual([]);
  });

  it('抓出重复 id', () => {
    const issues = validateContent({
      items: [baseItem({ id: 'a' }), baseItem({ id: 'a' })],
      members: [],
    });
    expect(issues.some((i) => i.code === 'duplicate-id')).toBe(true);
  });

  it('抓出缺必填字段', () => {
    const issues = validateContent({
      items: [baseItem({ title: '' })],
      members: [],
    });
    expect(issues.some((i) => i.code === 'missing-field' && i.field === 'title')).toBe(true);
  });

  it('抓出非法类型与非法状态', () => {
    const issues = validateContent({
      items: [baseItem({ type: 'nope' as any, publishState: 'weird' as any })],
      members: [],
    });
    expect(issues.some((i) => i.code === 'invalid-type')).toBe(true);
    expect(issues.some((i) => i.code === 'invalid-publish-state')).toBe(true);
  });

  it('抓出引用不存在的成员', () => {
    const issues = validateContent({
      items: [baseItem({ people: ['查无此人'] })],
      members: [baseMember()],
    });
    expect(issues.some((i) => i.code === 'unknown-person')).toBe(true);
  });

  it('抓出成员引用了不存在的内容', () => {
    const issues = validateContent({
      items: [],
      members: [baseMember({ projects: ['不存在'] })],
    });
    expect(issues.some((i) => i.code === 'unknown-project')).toBe(true);
  });

  it('缺 author 产生 warn 级问题', () => {
    const issues = validateContent({
      items: [baseItem({ author: undefined })],
      members: [],
    });
    const miss = issues.find((i) => i.code === 'missing-author');
    expect(miss).toBeDefined();
    expect(miss?.level).toBe('warn');
    expect(miss?.field).toBe('author');
  });

  it('有 author 不产生缺作者问题', () => {
    const issues = validateContent({
      items: [baseItem({ author: '张三' })],
      members: [],
    });
    expect(issues.some((i) => i.code === 'missing-author')).toBe(false);
  });

  it('抓出日期格式错误', () => {
    const issues = validateContent({
      items: [baseItem({ date: '2026/10/01' })],
      members: [],
    });
    expect(issues.some((i) => i.code === 'invalid-date')).toBe(true);
  });
});

describe('可见性', () => {
  it('只返回已发布内容', () => {
    const list = [
      baseItem({ id: 'a', publishState: 'published' }),
      baseItem({ id: 'b', publishState: 'draft' }),
      baseItem({ id: 'c', publishState: 'reviewing' }),
      baseItem({ id: 'd', publishState: 'unpublished' }),
    ];
    expect(publishedItems(list).map((i) => i.id)).toEqual(['a']);
  });
});

describe('过期自动下架', () => {
  const now = new Date('2026-10-25T12:00:00');

  it('过期内容仍保留在列表（只标注，不下架）', () => {
    const list = [baseItem({ id: 'a', expiresAt: '2026-10-01' })];
    expect(publishedItems(list).map((i) => i.id)).toEqual(['a']);
    expect(isExpired(list[0], now)).toBe(true);
  });

  it('没有过期时间的内容不受影响', () => {
    const list = [baseItem({ id: 'a' })];
    expect(isExpired(list[0], now)).toBe(false);
  });

  it('未发布内容不出现在列表', () => {
    const list = [baseItem({ id: 'a', publishState: 'draft' })];
    expect(publishedItems(list)).toEqual([]);
  });
});

describe('90 天复核（issue #13）', () => {
  const now = new Date('2026-10-25T12:00:00Z');
  const pub = (id: string, over = {}) => ({ id, title: `标题${id}`, publishState: 'published', ...over });

  it('最近复核超过阈值 → 超龄进待复核清单', () => {
    const log = [{ id: 'a', type: 'review', at: '2026-06-01T00:00:00Z' }];
    expect(overdueReviews([pub('a')], log, now, 90).map((i) => i.id)).toEqual(['a']);
  });

  it('阈值内发布/复核过 → 不超龄', () => {
    const log = [
      { id: 'a', to: 'published', at: '2026-10-01T00:00:00Z' },
      { id: 'a', type: 'review', at: '2026-10-10T00:00:00Z' },
    ];
    expect(overdueReviews([pub('a')], log, now, 90)).toEqual([]);
    expect(lastReviewAt(log, 'a')).toBe('2026-10-10T00:00:00Z');
  });

  it('无复核记录的已发布条目算超龄，未发布不进清单', () => {
    const due = overdueReviews([pub('a'), pub('b', { publishState: 'draft' })], [], now, 90);
    expect(due.map((i) => i.id)).toEqual(['a']);
    expect(due[0].lastReviewAt).toBeNull();
  });
});

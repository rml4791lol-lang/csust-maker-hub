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

describe('类型专属字段校验（API 写入守卫）', () => {
  const validGuide = (over: Partial<Item> = {}): Item =>
    baseItem({
      id: 'g9',
      type: 'guide',
      extra: {
        scene: '周五 17:00 前要交周报，平均花 90 分钟',
        path: ['第一步', '第二步', '第三步'],
        prompt: '你是我的工作助理，禁止空话',
        pitfalls: ['坑一', '坑二', '坑三'],
        usage: '用了 4 周，90 分钟降到 15 分钟',
      },
      ...over,
    });

  const errorCodes = (item: Item) =>
    validateContent({ items: [item], members: [] })
      .filter((i) => i.level === 'error')
      .map((i) => i.code);

  it('完整攻略通过', () => {
    expect(errorCodes(validGuide())).toEqual([]);
  });

  it('攻略缺五段中的任意一段 → error', () => {
    const item = validGuide();
    delete (item.extra as any).pitfalls;
    expect(errorCodes(item)).toContain('missing-guide-section');
  });

  it('攻略路径不足 3 步 → error', () => {
    const item = validGuide();
    (item.extra as any).path = ['只有一步'];
    expect(errorCodes(item)).toContain('bad-guide-path');
  });

  it('攻略常见错误不足 3 条 → error', () => {
    const item = validGuide();
    (item.extra as any).pitfalls = ['只有一条'];
    expect(errorCodes(item)).toContain('bad-guide-pitfalls');
  });

  it('使用记录仍是 [待补充] → warn 不阻塞', () => {
    const item = validGuide();
    (item.extra as any).usage = '尚未实测，[待补充]';
    const issues = validateContent({ items: [item], members: [] });
    expect(issues.find((i) => i.code === 'placeholder-usage')?.level).toBe('warn');
  });

  it('技能指令缺 command / appliesTo → error', () => {
    const item = baseItem({ id: 's9', type: 'skill', extra: {} });
    expect(errorCodes(item)).toEqual(
      expect.arrayContaining(['missing-skill-command', 'missing-skill-applies-to'])
    );
  });

  it('模板缺 downloadUrl → error，非法地址 → error', () => {
    const missing = baseItem({ id: 't9', type: 'template', extra: {} });
    expect(errorCodes(missing)).toContain('missing-download-url');
    const bad = baseItem({ id: 't8', type: 'template', extra: { downloadUrl: 'downloads/x.md' } });
    expect(errorCodes(bad)).toContain('invalid-download-url');
  });

  it('外部项目缺 url / url 非 http → error', () => {
    const missing = baseItem({ id: 'l9', type: 'link', extra: {} });
    expect(errorCodes(missing)).toContain('missing-link-url');
    const bad = baseItem({ id: 'l8', type: 'link', extra: { url: 'github.com/x' } });
    expect(errorCodes(bad)).toContain('invalid-link-url');
  });

  it('培训通知缺 deadline → error；档案类不要求', () => {
    const notice = baseItem({ id: 'tr9', type: 'training', extra: { kind: 'notice' } });
    expect(errorCodes(notice)).toContain('missing-training-deadline');
    const archive = baseItem({ id: 'tr8', type: 'training', extra: { kind: 'archive' } });
    expect(errorCodes(archive)).toEqual([]);
  });

  it('sourceUrl 非法 → error', () => {
    const item = validGuide({ extra: { ...(validGuide().extra as any), sourceUrl: 'ai.an520.xin/x' } });
    expect(errorCodes(item)).toContain('invalid-source-url');
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

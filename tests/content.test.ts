import { describe, it, expect } from 'vitest';
import { validateContent, validateCurrentContent, publishedItems } from '../src/data/validate';
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
  it('仓库现有内容全部通过', () => {
    expect(validateCurrentContent()).toEqual([]);
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

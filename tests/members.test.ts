import { describe, it, expect } from 'vitest';
import { members, depts, memberById, memberExists } from '../src/data/members';

describe('成员档案数据（content/members.json）', () => {
  it('成员列表非空且 id 唯一', () => {
    expect(members.length).toBeGreaterThan(0);
    expect(new Set(members.map((m) => m.id)).size).toBe(members.length);
  });

  it('部门都在允许的部门列表里', () => {
    const invalid = members.filter((m) => !depts.includes(m.dept)).map((m) => m.name + ':' + m.dept);
    expect(invalid).toEqual([]);
  });

  it('能够按 id 查询成员', () => {
    const first = members[0];
    expect(memberById(first.id)?.name).toBe(first.name);
    expect(memberExists(first.id)).toBe(true);
    expect(memberExists('not-exist')).toBe(false);
  });
});

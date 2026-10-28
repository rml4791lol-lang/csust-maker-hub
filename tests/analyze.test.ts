import { describe, it, expect } from 'vitest';
import { analyzeMemberProfiles } from '../src/data/analyze';
import type { Submission } from '../src/data/contributions';

const member = {
  id: 'm01',
  name: '陈屿',
  dept: '技术部' as const,
  grade: '2024 级',
  skills: ['前端', 'Astro'],
  projects: [],
};
const other = { ...member, id: 'm02', name: '林知', skills: ['Python'] };

const sub = (over: Partial<Submission>): Submission => ({
  id: 's1',
  memberId: 'm01',
  memberName: '陈屿',
  dept: '技术部',
  type: 'project',
  title: '校园电子班车表上线',
  date: '2026-10-01',
  description: '把校车时刻、实时位置做进小程序，覆盖 200 名同学，解决群里每天问车到哪了的问题。',
  status: 'published',
  submittedAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

describe('成员能力自动分析（规则模式）', () => {
  it('从成果记录生成摘要、标签、代表成果与统计', () => {
    const list = [
      sub({ id: 'a', outcome: '上线 1 个版本，200 名同学使用' }),
      sub({ id: 'b', type: 'competition', title: '机械创新设计大赛省赛', description: '负责算法与嵌入式部分，进入省赛答辩。' }),
      sub({ id: 'c', memberId: 'm02', memberName: '林知', title: '数据看板', description: '用 Python 做协会数据统计看板。' }),
      sub({ id: 'd', memberId: 'm02', memberName: '林知', type: 'talk', title: 'AI 工具工作坊', description: '带一次 AI 工具工作坊。' }),
      sub({ id: 'e', memberId: 'm02', memberName: '林知', status: 'pending', title: '未发布记录', description: '不应计入统计。' }),
    ];
    const profiles = analyzeMemberProfiles(list, [member, other], new Date('2026-10-28T00:00:00Z'));

    const chen = profiles.find((p) => p.memberId === 'm01')!;
    expect(chen.stats.contributions).toBe(2);
    expect(chen.stats.projects).toBe(1);
    expect(chen.stats.competitions).toBe(1);
    expect(chen.aiSummary).toContain('2 条成果');
    expect(chen.focusTags.length).toBeGreaterThan(0);
    expect(chen.highlights.length).toBeLessThanOrEqual(3);
    expect(chen.aiUpdatedAt).toBe('2026-10-28');

    const lin = profiles.find((p) => p.memberId === 'm02')!;
    expect(lin.stats.contributions).toBe(2);
    expect(lin.aiSummary).toContain('林知');
  });

  it('没有成果的成员给出补录建议', () => {
    const profiles = analyzeMemberProfiles([], [member]);
    expect(profiles[0].stats.contributions).toBe(0);
    expect(profiles[0].nextStep).toContain('提交第一条');
    expect(profiles[0].aiSummary).toContain('暂无成果记录');
  });
});

import { describe, it, expect } from 'vitest';
import {
  validateSubmission,
  validateContributions,
  publishedSubmissions,
  submissionsByMember,
  profiles,
  submissions,
} from '../src/data/contributions';
import { members } from '../src/data/members';

const valid = {
  memberId: 'm01',
  type: 'project',
  title: '校园电子班车表上线',
  date: '2026-10-01',
  description: '把校车时刻、实时位置和到站提醒做成小程序，覆盖 200 名同学，解决了群里每天问「车到哪了」的问题。',
  outcome: '上线 1 个版本，200 名同学使用',
  link: 'https://example.com/bus',
};

describe('成员成果投稿', () => {
  it('仓库现有投稿数据无校验问题', () => {
    expect(validateContributions(submissions).map((i) => i.message)).toEqual([]);
  });

  it('完整投稿通过校验', () => {
    expect(validateSubmission(valid)).toEqual([]);
  });

  it('缺成员 / 标题过短 / 描述过短 / 未来日期 / 非法链接都会被拦', () => {
    const codes = validateSubmission({
      ...valid,
      memberId: 'nope',
      title: '短',
      description: '太短',
      date: '2099-01-01',
      link: 'example.com',
    }).map((i) => i.field);
    expect(codes).toEqual(expect.arrayContaining(['memberId', 'title', 'description', 'date', 'link']));
  });

  it('当天日期可以通过，明天会被拦（时区安全）', () => {
    const now = new Date(2026, 9, 28, 12, 0, 0);
    expect(validateSubmission({ ...valid, date: '2026-10-28' }, now)).toEqual([]);
    expect(validateSubmission({ ...valid, date: '2026-10-29' }, now).map((i) => i.field)).toContain('date');
  });

  it('配图必须是 http(s) 地址', () => {
    expect(validateSubmission({ ...valid, image: 'https://example.com/a.png' })).toEqual([]);
    expect(validateSubmission({ ...valid, image: 'javascript:alert(1)' }).map((i) => i.field)).toContain('image');
  });

  it('只有已发布投稿对外可见', () => {
    const list = [
      { ...valid, id: 'a', status: 'published' as const },
      { ...valid, id: 'b', status: 'pending' as const },
      { ...valid, id: 'c', status: 'rejected' as const },
    ];
    expect(publishedSubmissions(list as any).map((s) => s.id)).toEqual(['a']);
  });

  it('按成员归集并按日期倒序', () => {
    const list = [
      { ...valid, id: 'a', date: '2026-01-01', status: 'published' as const },
      { ...valid, id: 'b', date: '2026-05-01', status: 'published' as const },
      { ...valid, id: 'c', date: '2026-03-01', status: 'published' as const, memberId: 'm02', memberName: '林知' },
    ];
    expect(submissionsByMember('m01', list as any).map((s) => s.id)).toEqual(['b', 'a']);
  });
});

describe('成员 AI 档案', () => {
  it('每个成员都有档案，且 AI 汇总非空', () => {
    expect(profiles.length).toBe(members.length);
    for (const p of profiles) {
      expect(p.aiSummary.trim().length).toBeGreaterThan(10);
      expect(p.focusTags.length).toBeGreaterThan(0);
      // 有成果的成员必须有代表成果；新加入、暂无记录的成员允许为空
      if (p.stats.contributions > 0) expect(p.highlights.length).toBeGreaterThan(0);
    }
  });

  it('档案统计与实际投稿一致', () => {
    const published = publishedSubmissions();
    for (const p of profiles) {
      expect(p.stats.contributions).toBe(published.filter((s) => s.memberId === p.memberId).length);
    }
  });
});

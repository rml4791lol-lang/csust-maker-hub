/**
 * 成员能力分析：从成果记录自动生成每位成员的 AI 汇总档案。
 *
 * 两种模式：
 *  - 规则分析（默认）：关键词匹配 + 成果类型权重，零依赖、可离线跑；
 *  - LLM 分析：服务器配置 AI_API_KEY / AI_BASE_URL / AI_MODEL 后，
 *    调用 OpenAI 兼容接口生成更自然的总结，失败自动回退规则分析。
 *
 * 调用方：scripts/analyze-profiles.ts（pnpm analyze）与后台审核后自动触发。
 */
import { members, type Member } from './members';
import type { ContributionType, MemberProfile, Submission } from './contributions';

/** 能力标签 ← 关键词：命中越多，标签越靠前 */
const SKILL_KEYWORDS: Record<string, string[]> = {
  'AI 工具': ['AI', 'chatgpt', 'deepseek', 'claude', '提示词', 'agent', '大模型', '模型'],
  前端: ['前端', '界面', 'UI', '小程序', '网页', 'react', 'vue', 'astro', '交互'],
  后端: ['后端', 'API', 'fastapi', '服务', '接口', '部署', '服务器'],
  数据: ['数据', '统计', '看板', '分析', '表格', '指标'],
  教学与分享: ['课程', '教学', '工作坊', '分享', '培训', '讲课', '复盘'],
  竞赛: ['竞赛', '比赛', '国赛', '省赛', '答辩', '获奖', '名次', '一等奖'],
  项目落地: ['项目', '上线', '落地', '交付', '版本', '需求'],
  内容与视觉: ['视觉', '设计', '视频', '剪辑', '摄影', '推文', '海报', '文案'],
  软著与材料: ['软著', '专利', '材料', '商业计划', '申报'],
  机器人与硬件: ['机器人', '嵌入式', '控制', '硬件', '单片机'],
};

const TYPE_WEIGHT: Record<ContributionType, number> = {
  competition: 3,
  project: 2.5,
  course: 2,
  practice: 2,
  talk: 1.5,
  other: 1,
};

const byDateDesc = (a: Submission, b: Submission) => (a.date < b.date ? 1 : -1);

/** 规则分析：从成果记录推导能力标签、代表成果、汇总文案与下一步建议 */
export function analyzeMemberProfiles(
  submissions: Submission[],
  memberList: Member[] = members,
  today = new Date()
): MemberProfile[] {
  const published = submissions.filter((s) => s.status === 'published');
  const dateStr = today.toISOString().slice(0, 10);

  return memberList.map((m) => {
    const own = published.filter((s) => s.memberId === m.id).sort(byDateDesc);
    const text = own.map((s) => `${s.title} ${s.description} ${s.outcome ?? ''}`).join(' ').toLowerCase();

    const scores = new Map<string, number>();
    for (const [tag, kws] of Object.entries(SKILL_KEYWORDS)) {
      for (const kw of kws) {
        if (text.includes(kw.toLowerCase())) scores.set(tag, (scores.get(tag) ?? 0) + 1);
      }
    }
    let focusTags = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t);
    if (!focusTags.length) focusTags = m.skills.slice(0, 3);

    const highlights = [...own]
      .sort((a, b) => (TYPE_WEIGHT[b.type] ?? 1) - (TYPE_WEIGHT[a.type] ?? 1) || byDateDesc(a, b))
      .slice(0, 3)
      .map((s) => `${s.title}${s.outcome ? `：${s.outcome}` : ''}（${s.date}）`);

    const stats = {
      contributions: own.length,
      projects: own.filter((s) => s.type === 'project').length,
      competitions: own.filter((s) => s.type === 'competition').length,
      activities: own.filter((s) => ['talk', 'course', 'practice'].includes(s.type)).length,
      firstDate: own.length ? own[own.length - 1].date : undefined,
      lastDate: own.length ? own[0].date : undefined,
    };

    const roleText = m.role ? `（${m.role}）` : '';
    const aiSummary = own.length
      ? `${m.name}${roleText}是${m.dept}成员，目前记录 ${own.length} 条成果，主要集中在${focusTags.slice(0, 3).join('、')}；代表成果：${own
          .slice(0, 2)
          .map((s) => s.title)
          .join('、')}。`
      : `${m.name}${roleText}是${m.dept}成员，暂无成果记录。建议从最近一次项目、工作坊或分享开始补充。`;

    const missingOutcome = own.some((s) => !s.outcome);
    const singleType = own.length > 0 && own.every((s) => s.type === own[0].type);
    const nextStep = !own.length
      ? '提交第一条成果记录（项目、竞赛、工作坊都算），档案会自动生成。'
      : missingOutcome
        ? '给已有成果补齐可量化的产出（人数 / 版本 / 时长 / 名次），AI 汇总会更准确。'
        : singleType
          ? '尝试记录不同类型（项目、竞赛、课程、分享）的成果，让能力画像更完整。'
          : '把最近一条成果整理成可复用的模板或分享，带动其他成员一起做。';

    return {
      memberId: m.id,
      name: m.name,
      dept: m.dept,
      role: m.role,
      grade: m.grade,
      aiSummary,
      focusTags,
      highlights,
      nextStep,
      stats,
      aiUpdatedAt: dateStr,
    };
  });
}

/** 可选 LLM 增强：配置 AI_API_KEY + AI_BASE_URL 时启用，失败自动回退规则分析 */
export async function analyzeWithLLM(
  submissions: Submission[],
  memberList: Member[] = members,
  today = new Date()
): Promise<MemberProfile[]> {
  const fallback = analyzeMemberProfiles(submissions, memberList, today);
  const key = process.env.AI_API_KEY;
  const baseURL = process.env.AI_BASE_URL;
  if (!key || !baseURL) return fallback;

  const model = process.env.AI_MODEL || 'deepseek-chat';
  const published = submissions.filter((s) => s.status === 'published');

  const results = await Promise.all(
    fallback.map(async (profile) => {
      const own = published.filter((s) => s.memberId === profile.memberId).sort(byDateDesc);
      if (!own.length) return profile;
      try {
        const res = await fetch(`${baseURL.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            temperature: 0.3,
            messages: [
              {
                role: 'system',
                content:
                  '你是学生协会的能力画像助手。根据成员成果记录，输出严格 JSON：{"summary":"2 句话总结这个人在做什么、擅长什么（可引用事实）","tags":["能力标签，3-5 个"],"highlights":["代表成果，最多 3 条，带事实"],"nextStep":"一条具体可行的下一步建议"}。不要编造记录里没有的事实。',
              },
              {
                role: 'user',
                content: `成员：${profile.name}（${profile.dept}，${profile.grade}${profile.role ? `，${profile.role}` : ''}）\n成果记录：\n${own
                  .map((s) => `- ${s.date} [${s.type}] ${s.title}：${s.description}${s.outcome ? `（产出：${s.outcome}）` : ''}`)
                  .join('\n')}`,
              },
            ],
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) return profile;
        const data: any = await res.json();
        const raw = String(data?.choices?.[0]?.message?.content ?? '');
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start < 0 || end < 0) return profile;
        const parsed = JSON.parse(raw.slice(start, end + 1));
        return {
          ...profile,
          aiSummary: String(parsed.summary || profile.aiSummary).slice(0, 400),
          focusTags: Array.isArray(parsed.tags) && parsed.tags.length ? parsed.tags.slice(0, 5).map(String) : profile.focusTags,
          highlights: Array.isArray(parsed.highlights) && parsed.highlights.length ? parsed.highlights.slice(0, 3).map(String) : profile.highlights,
          nextStep: parsed.nextStep ? String(parsed.nextStep).slice(0, 200) : profile.nextStep,
        } satisfies MemberProfile;
      } catch {
        return profile;
      }
    })
  );
  return results;
}

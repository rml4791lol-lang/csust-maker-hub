import submissionsRaw from '../../content/submissions.json';
import profilesRaw from '../../content/profiles.json';
import { members, type Member } from './members';

/** 成员成果类型：项目 / 竞赛 / 课程 / 实操 / 分享 / 其他 */
export type ContributionType = 'project' | 'competition' | 'course' | 'practice' | 'talk' | 'other';
/** 投稿生命周期：待审 / 已发布 / 已退回 */
export type SubmissionStatus = 'pending' | 'published' | 'rejected';

export interface Submission {
  id: string;
  memberId: string;
  memberName: string;
  dept?: string;
  type: ContributionType;
  title: string;
  /** YYYY-MM-DD：成果发生的日期 */
  date: string;
  description: string;
  /** 可量化的产出或结果（人数 / 版本 / 时长 / 名次等） */
  outcome?: string;
  /** 相关链接（作品、仓库、推文、视频等） */
  link?: string;
  /** 成果配图（可选，http(s) 地址；没填就只展示文字） */
  image?: string;
  /** 佐证说明（谁可以证明、材料在哪） */
  evidence?: string;
  status: SubmissionStatus;
  /** ISO 时间：提交时间 */
  submittedAt: string;
  reviewedAt?: string;
  /** 审核备注 / 退回原因 */
  note?: string;
  /** form = 成员自己填；backfill = 从内容库回填 */
  source?: 'form' | 'backfill';
}

export interface MemberProfileStats {
  contributions: number;
  projects: number;
  competitions: number;
  activities: number;
  firstDate?: string;
  lastDate?: string;
}

/** AI（agent）对单个成员的汇总档案：由 agent 读取投稿后写入 */
export interface MemberProfile {
  memberId: string;
  name: string;
  dept: string;
  role?: string;
  grade: string;
  /** AI 汇总：这个人在做什么、擅长什么 */
  aiSummary: string;
  /** AI 提炼的关注方向 / 能力标签 */
  focusTags: string[];
  /** AI 挑出的代表成果（每条一句话，带事实） */
  highlights: string[];
  /** AI 给的下一步建议（可选） */
  nextStep?: string;
  stats: MemberProfileStats;
  aiUpdatedAt: string;
}

export const contributionTypeLabel: Record<ContributionType, string> = {
  project: '项目',
  competition: '竞赛',
  course: '课程',
  practice: '实操',
  talk: '分享',
  other: '其他',
};

export const submissionStatusLabel: Record<SubmissionStatus, string> = {
  pending: '待审核',
  published: '已发布',
  rejected: '已退回',
};

export const submissions = submissionsRaw as Submission[];
export const profiles = profilesRaw as MemberProfile[];

/** 对外可见的投稿：只有已发布 */
export function publishedSubmissions(list: Submission[] = submissions): Submission[] {
  return list.filter((s) => s.status === 'published');
}

/** 按成员归集投稿（默认只取已发布，按日期倒序） */
export function submissionsByMember(memberId: string, list: Submission[] = publishedSubmissions()): Submission[] {
  return list
    .filter((s) => s.memberId === memberId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function profileByMember(memberId: string): MemberProfile | undefined {
  return profiles.find((p) => p.memberId === memberId);
}

/** 成员的投稿统计（公开页面用已发布口径） */
export function memberContributionStats(memberId: string): { total: number; byType: Record<string, number> } {
  const list = submissionsByMember(memberId);
  const byType: Record<string, number> = {};
  for (const s of list) byType[s.type] = (byType[s.type] || 0) + 1;
  return { total: list.length, byType };
}

/** 全站成果墙：最近发布的投稿 */
export function recentSubmissions(limit = 6): Submission[] {
  return [...publishedSubmissions()].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
}

/**
 * 展示用「团队成果」：内容库回填会给每位参与人生成一条记录，
 * 墙上按「标题 + 日期」合并，避免同一成果重复出现。
 */
export interface AchievementGroup {
  key: string;
  title: string;
  date: string;
  type: ContributionType;
  description: string;
  outcome?: string;
  image?: string;
  link?: string;
  members: { id: string; name: string; dept?: string }[];
  depts: string[];
  ids: string[];
}

export function groupAchievements(list: Submission[] = publishedSubmissions()): AchievementGroup[] {
  const groups: AchievementGroup[] = [];
  const byKey = new Map<string, AchievementGroup>();
  for (const s of [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))) {
    const key = `${s.title}||${s.date}`;
    let g = byKey.get(key);
    if (!g) {
      g = {
        key,
        title: s.title,
        date: s.date,
        type: s.type,
        description: s.description,
        outcome: s.outcome,
        image: s.image,
        link: s.link,
        members: [],
        depts: [],
        ids: [],
      };
      byKey.set(key, g);
      groups.push(g);
    }
    if (!g.members.some((m) => m.id === s.memberId)) g.members.push({ id: s.memberId, name: s.memberName, dept: s.dept });
    if (s.dept && !g.depts.includes(s.dept)) g.depts.push(s.dept);
    g.ids.push(s.id);
    if (!g.image && s.image) g.image = s.image;
    if (!g.link && s.link) g.link = s.link;
    if (!g.outcome && s.outcome) g.outcome = s.outcome;
  }
  return groups.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** 首页用的最近团队成果 */
export function recentAchievements(limit = 6): AchievementGroup[] {
  return groupAchievements().slice(0, limit);
}

/* ---------------------------- 校验（表单 + API 共用） ---------------------------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TYPE_SET: ContributionType[] = ['project', 'competition', 'course', 'practice', 'talk', 'other'];
const STATUS_SET: SubmissionStatus[] = ['pending', 'published', 'rejected'];

export interface ContributionIssue {
  field: string;
  message: string;
}

export interface ContributionInput {
  memberId?: unknown;
  type?: unknown;
  title?: unknown;
  date?: unknown;
  description?: unknown;
  outcome?: unknown;
  link?: unknown;
  image?: unknown;
  evidence?: unknown;
}

/** 校验一条成员投稿。返回空数组表示通过。 */
export function validateSubmission(
  input: ContributionInput,
  now = new Date(),
  options: { skipMember?: boolean } = {}
): ContributionIssue[] {
  const issues: ContributionIssue[] = [];
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  if (!options.skipMember) {
    const member = members.find((m) => m.id === text(input.memberId));
    if (!member) issues.push({ field: 'memberId', message: '请选择协会成员' });
  }

  if (!TYPE_SET.includes(text(input.type) as ContributionType)) {
    issues.push({ field: 'type', message: '成果类型不合法' });
  }

  const title = text(input.title);
  if (title.length < 4 || title.length > 80) {
    issues.push({ field: 'title', message: '标题需 4~80 字' });
  }

  const desc = text(input.description);
  if (desc.length < 30) {
    issues.push({ field: 'description', message: '描述至少 30 字：做了什么、怎么做的、结果如何' });
  } else if (desc.length > 2000) {
    issues.push({ field: 'description', message: '描述不超过 2000 字' });
  }

  const date = text(input.date);
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (!DATE_RE.test(date)) {
    issues.push({ field: 'date', message: '日期格式必须是 YYYY-MM-DD' });
  } else if (date > today) {
    issues.push({ field: 'date', message: '日期不能晚于今天' });
  }

  const outcome = text(input.outcome);
  if (outcome.length > 200) issues.push({ field: 'outcome', message: '产出说明不超过 200 字' });

  const link = text(input.link);
  if (link && !/^https?:\/\//.test(link)) {
    issues.push({ field: 'link', message: '链接必须以 http(s):// 开头' });
  }

  const image = text(input.image);
  if (image && !/^https?:\/\//.test(image)) {
    issues.push({ field: 'image', message: '配图链接必须以 http(s):// 开头' });
  }

  const evidence = text(input.evidence);
  if (evidence.length > 300) issues.push({ field: 'evidence', message: '佐证说明不超过 300 字' });

  return issues;
}

/** 校验整个投稿库（构建期 / 测试用） */
export function validateContributions(list: Submission[], memberList: Member[] = members): ContributionIssue[] {
  const issues: ContributionIssue[] = [];
  const ids = new Set<string>();
  const memberIds = new Set(memberList.map((m) => m.id));
  for (const s of list) {
    const id = s?.id ?? '(无 id)';
    if (ids.has(id)) issues.push({ field: 'id', message: `投稿 id 重复：${id}` });
    ids.add(id);
    if (!memberIds.has(s.memberId)) issues.push({ field: 'memberId', message: `投稿 ${id} 指向不存在的成员：${s.memberId}` });
    if (!TYPE_SET.includes(s.type)) issues.push({ field: 'type', message: `投稿 ${id} 类型不合法` });
    if (!STATUS_SET.includes(s.status)) issues.push({ field: 'status', message: `投稿 ${id} 状态不合法` });
    if (!DATE_RE.test(s.date ?? '')) issues.push({ field: 'date', message: `投稿 ${id} 日期格式不合法` });
    if (!s.title || !s.title.trim()) issues.push({ field: 'title', message: `投稿 ${id} 缺标题` });
    if (!s.description || s.description.trim().length < 10) issues.push({ field: 'description', message: `投稿 ${id} 描述过短` });
  }
  return issues;
}

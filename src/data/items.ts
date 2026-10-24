export type ItemType = 'project' | 'competition' | 'activity' | 'course' | 'video';

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  summary: string;
  /** YYYY-MM-DD */
  date: string;
  status: string;
  people: string[];
  tags: string[];
  link?: string;
  extra?: {
    /** project */
    deliverable?: string;
    /** competition */
    level?: string;
    award?: string;
    team?: string;
    /** activity */
    place?: string;
    recap?: string;
    /** course */
    difficulty?: string;
    duration?: string;
    outline?: string[];
    /** video：播放器嵌入地址，留空则显示占位 */
    provider?: string;
    embedUrl?: string;
    cover?: string;
  };
}

export const typeMeta: Record<ItemType, { label: string; glyph: string; color: string }> = {
  project: { label: '项目', glyph: '项', color: '#e0632f' },
  competition: { label: '竞赛', glyph: '赛', color: '#c9a227' },
  activity: { label: '活动', glyph: '活', color: '#5e9bd6' },
  course: { label: '课程', glyph: '课', color: '#6bb08a' },
  video: { label: '视频', glyph: '播', color: '#dc2626' },
};

export const items: Item[] = [
  {
    id: 'p01',
    type: 'project',
    title: '校园电子班车表',
    summary: '把校车时刻、实时位置和到站提醒做成一个小程序，结束群里天天问「车到哪了」。',
    date: '2026-09-18',
    status: '已上线',
    people: ['陈屿', '叶明'],
    tags: ['小程序', '校园服务', '前端'],
    extra: { deliverable: '产品' },
  },
  {
    id: 'p02',
    type: 'project',
    title: '创客空间数据看板',
    summary: '把成员、项目、需求、活动四类数据汇到一个看板，每周更新一次，代替手工统计。',
    date: '2026-10-08',
    status: '进行中',
    people: ['林知', '周行'],
    tags: ['数据', '看板', '自动化'],
    extra: { deliverable: '工具' },
  },
  {
    id: 'p03',
    type: 'project',
    title: 'AI 需求登记与分派流程',
    summary: '部门提需求 → 自动分类 → 分派给接口人 → 到期提醒。替代微信群接龙。',
    date: '2026-09-02',
    status: '进行中',
    people: ['陈屿', '周行'],
    tags: ['AI', '工作流', '服务台'],
    extra: { deliverable: '产品' },
  },
  {
    id: 'p04',
    type: 'project',
    title: 'AI 视觉素材库',
    summary: '宣传部常用的海报模板、配色、字体和提示词，整理成一套能直接套用的素材包。',
    date: '2026-08-26',
    status: '已上线',
    people: ['沈青'],
    tags: ['设计', 'AI 出图', '素材'],
    extra: { deliverable: '素材包' },
  },
  {
    id: 'p05',
    type: 'project',
    title: '软著材料自动化',
    summary: '从项目 README 直接生成软著申请材料初稿，把原来两天的活压到两小时。',
    date: '2026-10-12',
    status: '进行中',
    people: ['许川', '唐迟'],
    tags: ['软著', '文档', 'AI'],
    extra: { deliverable: '软著' },
  },
  {
    id: 'k01',
    type: 'competition',
    title: '全国大学生机械创新设计大赛',
    summary: '校内选拔已出结果，省赛队伍在准备实物和答辩材料。',
    date: '2026-10-20',
    status: '备赛中',
    people: ['苏禾', '顾言', '程野'],
    tags: ['国赛', '机械', '组队'],
    extra: { level: '国家级', team: '3 支队伍' },
  },
  {
    id: 'k02',
    type: 'competition',
    title: '中国国际大学生创新大赛',
    summary: '校赛报名已开，重点在高教主赛道和青年红色筑梦之旅赛道。',
    date: '2026-09-28',
    status: '报名中',
    people: ['苏禾', '唐迟'],
    tags: ['国赛', '创新创业', '组队'],
    extra: { level: '国家级', team: '招募中' },
  },
  {
    id: 'a01',
    type: 'activity',
    title: 'AI 工具工作坊 · 第一期',
    summary: '两个小时的动手场：现场用 AI 把一件重复的活自动化，带走一个能跑的流程。',
    date: '2026-10-16',
    status: '已结束',
    people: ['沈青', '夏至'],
    tags: ['工作坊', 'AI', '培训'],
    extra: { place: '工训大楼 302', recap: '到场 34 人，现场产出 11 个可复用流程。' },
  },
  {
    id: 'a02',
    type: 'activity',
    title: '创客开放日',
    summary: '对外展示协会项目和成果，招新同步进行。',
    date: '2026-09-25',
    status: '已结束',
    people: ['白露'],
    tags: ['展示', '招新'],
    extra: { place: '云塘校区 · 创客空间', recap: '展示项目 8 个，登记意向 25 人。' },
  },
  {
    id: 'c01',
    type: 'course',
    title: '用 AI 做第一个自动化流程',
    summary: '入门课。不写代码，用现成工具把每周重复做的事变成一句话触发的流程。',
    date: '2026-10-10',
    status: '可学习',
    people: ['林知'],
    tags: ['AI', '自动化', '入门'],
    extra: {
      difficulty: '入门',
      duration: '2 小时',
      outline: ['找到值得自动化的重复劳动', '用提示词把步骤写清楚', '拼成一个可运行的流程', '怎么分享给不会用的人'],
    },
  },
  {
    id: 'c02',
    type: 'course',
    title: '从零做一个能上线的静态网站',
    summary: '进阶课。用 Astro 做一个真站点，学会内容组织、构建和部署。',
    date: '2026-10-24',
    status: '可学习',
    people: ['陈屿'],
    tags: ['前端', 'Astro', '部署'],
    extra: {
      difficulty: '进阶',
      duration: '4 小时',
      outline: ['静态站和动态站的区别', '内容结构怎么设计', '构建与预览', '部署到自己的域名'],
    },
  },
  {
    id: 'c03',
    type: 'course',
    title: '软著申请：从项目到材料',
    summary: '把做过的东西变成一份能提交的软著材料，附模板和常见退回原因。',
    date: '2026-10-22',
    status: '可学习',
    people: ['许川'],
    tags: ['软著', '材料', '模板'],
    extra: {
      difficulty: '入门',
      duration: '1.5 小时',
      outline: ['哪些项目适合申请', '材料清单和顺序', '代码和说明书怎么写', '常见退回原因'],
    },
  },
  {
    id: 'v01',
    type: 'video',
    title: 'AI 工具工作坊 · 第一期回放',
    summary: '两小时的动手场完整录像。现场把一件重复的活自动化，从找场景到跑通流程。',
    date: '2026-10-17',
    status: '可观看',
    people: ['沈青', '夏至'],
    tags: ['工作坊', 'AI', '回放'],
    extra: {
      provider: 'bilibili',
      // 换成实际视频的 B 站 BV 号或播放器地址；留空则详情页显示占位
      embedUrl: '',
      duration: '1:52:30',
    },
  },
  {
    id: 'v02',
    type: 'video',
    title: '创客开放日 · 现场记录',
    summary: '项目展示和招新的现场剪辑，三分钟看完当天做了什么。',
    date: '2026-09-26',
    status: '可观看',
    people: ['白露'],
    tags: ['活动', '招新', '记录'],
    extra: {
      provider: 'mp4',
      embedUrl: '',
      duration: '3:12',
    },
  },
];

export function getItem(id: string) {
  return items.find((i) => i.id === id);
}
export function byType(t: ItemType) {
  return items.filter((i) => i.type === t);
}
export const sortedByDate = [...items].sort((a, b) => (a.date < b.date ? 1 : -1));

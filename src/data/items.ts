import publishOverrides from './publish-state.json';

export type ItemType =
  | 'guide'      // 攻略：问题场景 → 现成路径 → 提示词 → 使用记录
  | 'skill'      // 技能指令：可复制的 agent 指令
  | 'template'   // 模板素材：可下载
  | 'link'       // 外部项目：直达链接，无详情页
  | 'training'   // 培训：通知 / 档案
  // 以下为历史类型，保留兼容，逐步迁移
  | 'project'
  | 'competition'
  | 'activity'
  | 'course'
  | 'video';

export type PublishState = 'draft' | 'reviewing' | 'published' | 'unpublished';
export type ReviewMethod = 'agent' | 'human' | 'both';

export interface Item {
  id: string;
  type: ItemType;
  /** 生命周期状态：决定是否对外可见 */
  publishState: PublishState;
  /** 作者 / 整理人 */
  author?: string;
  /** 审核人 */
  reviewer?: string;
  /** 审核时间 YYYY-MM-DD */
  reviewedAt?: string;
  /** 审核方式 */
  reviewMethod?: ReviewMethod;
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
    /** guide */
    scene?: string;
    path?: string[];
    prompt?: string;
    usage?: string;
    /** skill */
    command?: string;
    appliesTo?: string;
    /** template */
    downloadUrl?: string;
    /** link */
    url?: string;
    /** training */
    kind?: 'notice' | 'archive';
    deadline?: string;
    materials?: string;
  };
}

export const typeMeta: Record<ItemType, { label: string; glyph: string; color: string }> = {
  project: { label: '项目', glyph: '项', color: '#e0632f' },
  competition: { label: '竞赛', glyph: '赛', color: '#c9a227' },
  activity: { label: '活动', glyph: '活', color: '#5e9bd6' },
  course: { label: '课程', glyph: '课', color: '#6bb08a' },
  video: { label: '视频', glyph: '播', color: '#dc2626' },
  guide: { label: '攻略', glyph: '攻', color: '#1a56db' },
  skill: { label: '技能指令', glyph: '令', color: '#7c3aed' },
  template: { label: '模板素材', glyph: '模', color: '#0f766e' },
  link: { label: '外部项目', glyph: '链', color: '#b45309' },
  training: { label: '培训', glyph: '训', color: '#be185d' },
};

const rawItems: Item[] = [
  // ---------- 五类新内容 ----------
  {
    id: 'g01',
    type: 'guide',
    publishState: 'published',
    title: '用 AI 把部门周报自动化',
    summary: '每周花两小时拼周报，改成录音加提示词，十分钟出初稿。',
    date: '2026-10-20',
    status: '可照做',
    people: ['林知'],
    tags: ['AI', '效率', '周报'],
    author: '林知',
    extra: {
      scene: '每周五下午要拼周报：翻群通知、翻文档、回忆这周做了啥，两小时起步，还容易漏。',
      path: [
        '周五上午用手机录音，口述这周做了哪几件事（不用组织语言）',
        '把录音丢给 agent，附上下面的提示词',
        'agent 输出初稿，人工删掉不重要的、补上数字',
        '直接发到部门群',
      ],
      prompt: '你是一名部门助理。这是我的口述录音转写，请整理成周报。要求：1）按「完成/进行中/下周计划/需要协调」四段；2）每件事一句话，不超过 30 字；3）保留所有数字和日期；4）不要加评论和修饰。',
      usage: '技术部连续用了 4 周，初稿可用率约八成，平均节省 90 分钟。',
    },
  },
  {
    id: 's01',
    type: 'skill',
    publishState: 'published',
    title: '把会议录音整理成纪要',
    summary: '一段可以直接粘给 agent 的指令，输出带待办和负责人的纪要。',
    date: '2026-10-18',
    status: '可直接用',
    people: ['陈屿'],
    tags: ['会议', '纪要', 'agent'],
    author: '陈屿',
    extra: {
      command: '读取我提供的会议录音转写。输出四部分：1）一句话结论；2）讨论要点（不超过 5 条，每条一句话）；3）待办清单（每条含：任务、负责人、截止时间，缺失就写「待确认」）；4）未决问题。不要复述全过程，不要加你的评价。',
      appliesTo: 'Claude Code / Codex / Cursor 通用',
    },
  },
  {
    id: 't01',
    type: 'template',
    publishState: 'published',
    title: '需求登记表模板',
    summary: '提需求前先对一遍字段，省掉来回问。',
    date: '2026-10-16',
    status: '可下载',
    people: ['陈屿'],
    tags: ['模板', '需求'],
    author: '陈屿',
    extra: { downloadUrl: '/downloads/demand-form.md' },
  },
  {
    id: 'l01',
    type: 'link',
    publishState: 'published',
    title: 'Datawhale 开源学习路线',
    summary: '完整的数据与 AI 学习路线，适合想系统入门的人。',
    date: '2026-10-15',
    status: '外部',
    people: ['林知'],
    tags: ['学习路线', '开源'],
    author: '林知',
    extra: { url: 'https://github.com/datawhalechina' },
  },
  {
    id: 'tr01',
    type: 'training',
    publishState: 'published',
    title: 'AI 工具工作坊 · 第二期',
    summary: '两小时动手场，带着一件重复劳动来，带着一个能跑的流程走。',
    date: '2026-10-26',
    status: '报名中',
    people: ['沈青', '夏至'],
    tags: ['工作坊', '培训'],
    author: '沈青',
    extra: {
      kind: 'notice',
      deadline: '2026-11-02',
      materials: '工训大楼 302，自备电脑',
    },
  },
  {
    id: 'p01',
    publishState: 'published',
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
    publishState: 'published',
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
    publishState: 'published',
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
    publishState: 'published',
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
    publishState: 'published',
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
    publishState: 'published',
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
    publishState: 'published',
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
    publishState: 'published',
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
    publishState: 'published',
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
    publishState: 'published',
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
    publishState: 'published',
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
    publishState: 'published',
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
    publishState: 'published',
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
    publishState: 'published',
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

/** 后台改的发布状态覆盖静态数据里的默认值 */
const overrides = publishOverrides as Record<string, PublishState>;

export const items: Item[] = rawItems.map((item) => ({
  ...item,
  publishState: overrides[item.id] ?? item.publishState,
}));

export function getItem(id: string) {
  return items.find((i) => i.id === id);
}
export function byType(t: ItemType) {
  return items.filter((i) => i.type === t);
}
export const sortedByDate = [...items].sort((a, b) => (a.date < b.date ? 1 : -1));

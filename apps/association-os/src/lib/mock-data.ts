// ============================================================
// 原型示例数据（mock）—— 仅用于高保真视觉验收
// 说明：赛事/活动名称为真实公开或常见类型，成员姓名与统计数字为示例数据，
//       不代表任何真实协会的实际成果，不得当作真实业务数据使用。
// ============================================================

import type { StatusTone } from "@/components/ui/status-tag";

/* ---------------- 指标（全协会总量） ---------------- */

export interface Metric {
  label: string;
  value: string;
  delta: string;
  period: string;
  spark: number[];
}

export const metrics: Metric[] = [
  { label: "在册成员", value: "46", delta: "+3", period: "本月", spark: [28, 30, 31, 34, 36, 39, 42, 46] },
  { label: "进行中项目", value: "11", delta: "+2", period: "本周", spark: [14, 13, 12, 12, 11, 10, 11, 11] },
  { label: "参赛队伍", value: "7", delta: "+1", period: "本周", spark: [4, 5, 5, 6, 6, 7, 7, 7] },
  { label: "竞赛成果", value: "12", delta: "+2", period: "本月", spark: [6, 7, 8, 9, 10, 11, 11, 12] },
];

/* ---------------- 我的待办（个人视角，替代「全协会审核队列」） ---------------- */

export type MyTaskKind = "review" | "submit" | "signup" | "reply" | "report";

export interface MyTask {
  id: string;
  title: string;
  due: string;
  kind: MyTaskKind;
  project?: string;
  urgency: "high" | "normal";
}

export const myTasks: MyTask[] = [
  { id: "t1", title: "审核「AI 周报自动化工作流」", due: "今天 18:00", kind: "review", urgency: "high" },
  { id: "t2", title: "提交软著申请材料", due: "明天", kind: "submit", project: "软著材料自动化", urgency: "high" },
  { id: "t3", title: "填写中国软件杯报名表", due: "本周五", kind: "signup", project: "中国软件杯", urgency: "normal" },
  { id: "t4", title: "回复项目讨论 2 条", due: "本周内", kind: "reply", project: "竞赛报名信息爬虫", urgency: "normal" },
];

/* ---------------- 快捷入口 ---------------- */

export interface QuickAction {
  label: string;
  key: "project" | "resource" | "competition" | "activity";
}

export const quickActions: QuickAction[] = [
  { label: "创建项目", key: "project" },
  { label: "提交资源", key: "resource" },
  { label: "登记参赛", key: "competition" },
  { label: "发起活动", key: "activity" },
];

/* ---------------- 足迹（成员自助） ---------------- */

export type ContributionStatus = "draft" | "pending" | "approved";

export interface Contribution {
  id: string;
  date: string;
  content: string;
  project?: string;
  hours: number;
  status: ContributionStatus;
}

export const myContributions: Contribution[] = [
  { id: "c1", date: "10-25", content: "完成主页 hero 与内容结构重排", project: "协会数字平台", hours: 3, status: "pending" },
  { id: "c2", date: "10-24", content: "整理软著申请材料第 2 版", project: "软著材料自动化", hours: 2, status: "approved" },
  { id: "c3", date: "10-23", content: "主持技术部周会并整理会议纪要", hours: 1, status: "approved" },
];

export const contributionStats = {
  weekCount: 3,
  monthCount: 11,
  pendingCount: 1,
  weekHours: 6,
};

/* ---------------- 即将截止（竞赛 + 培训 + 里程碑） ---------------- */

export type DeadlineKind = "competition" | "training" | "milestone" | "activity";

export interface Deadline {
  name: string;
  stage: string;
  daysLeft: number;
  kind: DeadlineKind;
}

export const deadlines: Deadline[] = [
  { name: "中国软件杯", stage: "报名截止", daysLeft: 3, kind: "competition" },
  { name: "AI 工具工作坊 · 第二期", stage: "报名截止", daysLeft: 5, kind: "training" },
  { name: "全国大学生机械创新设计大赛", stage: "省赛材料提交", daysLeft: 7, kind: "competition" },
  { name: "协会数字平台", stage: "里程碑：原型验收", daysLeft: 9, kind: "milestone" },
];

/* ---------------- 本周活动 ---------------- */

export type EventKind = "training" | "meeting" | "sharing" | "activity";

export interface WeekEvent {
  id: string;
  title: string;
  date: string;
  place: string;
  kind: EventKind;
  signup: string;
}

export const weekEvents: WeekEvent[] = [
  { id: "e1", title: "AI 工具工作坊 · 第二期", date: "周三 19:00", place: "工训大楼 302", kind: "training", signup: "已报名 24/30" },
  { id: "e2", title: "技术部周会", date: "周四 20:00", place: "线上", kind: "meeting", signup: "部门成员" },
  { id: "e3", title: "竞赛经验分享会", date: "周五 19:30", place: "工训大楼 201", kind: "sharing", signup: "已报名 18/40" },
  { id: "e4", title: "新成员见面会", date: "周六 14:00", place: "创客空间", kind: "activity", signup: "已报名 32/40" },
];

/* ---------------- 动态 ---------------- */

export interface Activity {
  type: "project" | "competition" | "publish" | "award" | "article";
  title: string;
  person: string;
  time: string;
  status: string;
  tone: StatusTone;
  relatedToMe?: boolean;
}

export const activities: Activity[] = [
  { type: "project", title: "「软著材料自动化」提交验收", person: "许川", time: "10 分钟前", status: "待验收", tone: "warning", relatedToMe: true },
  { type: "competition", title: "中国软件杯报名，剩 3 天截止", person: "苏禾", time: "2 小时前", status: "报名中", tone: "info", relatedToMe: true },
  { type: "publish", title: "资源「AI 周报自动化工作流」通过审核", person: "林知", time: "昨天 18:40", status: "已发布", tone: "success" },
  { type: "award", title: "蓝桥杯省赛二等奖 · 2 人获奖", person: "程野", time: "昨天 12:05", status: "已登记", tone: "success" },
  { type: "article", title: "技术文章「给知识库加 RAG 问答」更新", person: "陈屿", time: "2 天前", status: "已发布", tone: "success" },
  { type: "project", title: "「校园导览小程序」状态改为孵化中", person: "沈青", time: "3 天前", status: "孵化中", tone: "primary" },
];

/* ---------------- 项目 ---------------- */

export interface ProjectRow {
  name: string;
  owner: string;
  status: string;
  tone: StatusTone;
  updated: string;
}

export const projects: ProjectRow[] = [
  { name: "协会数字平台", owner: "陈屿", status: "开发中", tone: "info", updated: "10 分钟前" },
  { name: "软著材料自动化", owner: "许川", status: "答辩准备", tone: "warning", updated: "1 小时前" },
  { name: "周报自动化工作流", owner: "林知", status: "开发中", tone: "info", updated: "昨天" },
  { name: "竞赛报名信息爬虫", owner: "周行", status: "开发中", tone: "info", updated: "昨天" },
  { name: "会议纪要机器人", owner: "叶明", status: "已结项", tone: "success", updated: "上周" },
  { name: "校园导览小程序", owner: "沈青", status: "孵化中", tone: "primary", updated: "3 天前" },
  { name: "AI 简历助手", owner: "顾言", status: "立项", tone: "neutral", updated: "2 天前" },
  { name: "实验室设备预约", owner: "周行", status: "立项", tone: "neutral", updated: "4 天前" },
  { name: "课程作业查重工具", owner: "林知", status: "开发中", tone: "info", updated: "3 天前" },
  { name: "竞赛资料知识库", owner: "苏禾", status: "开发中", tone: "info", updated: "5 天前" },
  { name: "社团招新页面", owner: "白露", status: "答辩准备", tone: "warning", updated: "昨天" },
  { name: "推文自动排版", owner: "夏至", status: "已结项", tone: "success", updated: "2 周前" },
  { name: "机器人巡检", owner: "程野", status: "孵化中", tone: "primary", updated: "上周" },
  { name: "协会数据看板", owner: "唐迟", status: "已结项", tone: "success", updated: "3 周前" },
  { name: "软著材料模板库", owner: "许川", status: "已结项", tone: "success", updated: "上周" },
];

/* ---------------- 项目状态（协会词汇） ---------------- */

export interface StatusState {
  label: string;
  count: number;
  tone: StatusTone;
}

export const statusFlow: StatusState[] = [
  { label: "立项", count: 4, tone: "neutral" },
  { label: "开发中", count: 11, tone: "info" },
  { label: "答辩准备", count: 3, tone: "warning" },
  { label: "已结项", count: 6, tone: "success" },
  { label: "孵化中", count: 2, tone: "primary" },
];

/* ---------------- 成果 ---------------- */

export interface Award {
  title: string;
  level: string;
  person: string;
  date: string;
}

export const awards: Award[] = [
  { title: "蓝桥杯省赛二等奖", level: "省级", person: "程野", date: "10-24" },
  { title: "全国大学生机械创新设计大赛省赛", level: "省级", person: "苏禾", date: "10-14" },
  { title: "中国大学生计算机设计大赛", level: "国家级", person: "陈屿", date: "09-28" },
];

/* ---------------- 部门（真实 4 部门 + 人数 + 本月记录） ---------------- */

export interface Department {
  name: string;
  lead: string;
  active: number;
  contributions: number;
}

export const departments: Department[] = [
  { name: "技术部", lead: "陈屿", active: 4, contributions: 18 },
  { name: "竞赛部", lead: "苏禾", active: 3, contributions: 11 },
  { name: "宣传部", lead: "沈青", active: 3, contributions: 14 },
  { name: "创新创业部", lead: "许川", active: 2, contributions: 9 },
];

/* ---------------- 值班轮换（双周制） ---------------- */

export interface DutyShift {
  name: string;
  from: string;
  to: string;
  role: string;
}

export const dutyRota: DutyShift[] = [
  { name: "林知", from: "2026-10-13", to: "2026-10-26", role: "内容值班" },
  { name: "陈屿", from: "2026-10-27", to: "2026-11-09", role: "内容值班" },
];

/* ---------------- 五类内容（攻 / 令 / 模 / 链 / 训） ---------------- */

export type ContentType = "guide" | "skill" | "template" | "link" | "training";

export interface ContentTypeMeta {
  key: ContentType;
  plate: string;
  label: string;
  desc: string;
  count: number;
}

export const contentTypes: ContentTypeMeta[] = [
  { key: "guide", plate: "攻", label: "攻略", desc: "问题场景、现成路径、可复制提示词", count: 12 },
  { key: "skill", plate: "令", label: "技能指令", desc: "一段能直接复制给 agent 的指令", count: 8 },
  { key: "template", plate: "模", label: "模板素材", desc: "课程大纲、README、软著清单", count: 6 },
  { key: "link", plate: "链", label: "外部项目", desc: "筛过的开源项目和外部资源", count: 19 },
  { key: "training", plate: "训", label: "培训", desc: "线下培训通知、报名和档案", count: 5 },
];

/* ---------------- 主题域（一级分类，最多 6 个） ---------------- */

export interface Topic {
  key: string;
  label: string;
  count: number;
}

export const topics: Topic[] = [
  { key: "ai", label: "AI 应用", count: 16 },
  { key: "web", label: "Web 开发", count: 9 },
  { key: "hardware", label: "硬件与机器人", count: 5 },
  { key: "visual", label: "视觉与内容", count: 7 },
  { key: "startup", label: "竞赛与创业", count: 8 },
];

/* ---------------- 成员（真实 12 人） ---------------- */

export interface Member {
  id: string;
  name: string;
  dept: string;
  role?: string;
  grade: string;
  skills: string[];
}

export const members: Member[] = [
  { id: "m01", name: "陈屿", dept: "技术部", role: "部长", grade: "2024 级", skills: ["前端", "Astro", "AI 应用"] },
  { id: "m02", name: "林知", dept: "技术部", role: "课程负责人", grade: "2024 级", skills: ["Python", "数据处理", "教学"] },
  { id: "m03", name: "周行", dept: "技术部", grade: "2025 级", skills: ["后端", "FastAPI", "部署"] },
  { id: "m04", name: "苏禾", dept: "竞赛部", role: "部长", grade: "2024 级", skills: ["竞赛统筹", "答辩", "项目管理"] },
  { id: "m05", name: "顾言", dept: "竞赛部", grade: "2025 级", skills: ["算法", "嵌入式"] },
  { id: "m06", name: "沈青", dept: "宣传部", role: "部长", grade: "2024 级", skills: ["视觉设计", "AI 出图", "推文"] },
  { id: "m07", name: "白露", dept: "宣传部", grade: "2025 级", skills: ["视频剪辑", "摄影"] },
  { id: "m08", name: "许川", dept: "创新创业部", role: "部长", grade: "2023 级", skills: ["软著材料", "商业计划", "答辩"] },
  { id: "m09", name: "唐迟", dept: "创新创业部", grade: "2024 级", skills: ["文档撰写", "政策解读"] },
  { id: "m10", name: "叶明", dept: "技术部", grade: "2025 级", skills: ["小程序", "UI 实现"] },
  { id: "m11", name: "程野", dept: "竞赛部", grade: "2025 级", skills: ["机器人", "控制"] },
  { id: "m12", name: "夏至", dept: "宣传部", grade: "2025 级", skills: ["新媒体运营", "文案"] },
];

/* ---------------- 资源推荐 ---------------- */

export type ResourceKind = "guide" | "template" | "prompt" | "project";

export interface ResourceItem {
  title: string;
  kind: ResourceKind;
  author: string;
  meta: string;
}

export const recommendedResources: ResourceItem[] = [
  { title: "AI 周报自动化工作流", kind: "guide", author: "林晓", meta: "本周最热 · 已被使用 18 次" },
  { title: "软著申请材料清单", kind: "template", author: "许清", meta: "本季新增 · 竞赛部推荐" },
  { title: "给知识库加 RAG 问答", kind: "guide", author: "韩江", meta: "技术部推荐 · 阅读 124" },
  { title: "竞赛报名表模板", kind: "template", author: "苏澄", meta: "可直接复用" },
];

/* ---------------- 近 14 天活跃度（备用） ---------------- */

export const activityTrend = [
  12, 18, 14, 22, 19, 26, 24, 31, 28, 35, 33, 40, 38, 46,
];

export const trendLabels = [
  "10/12", "10/13", "10/14", "10/15", "10/16", "10/17", "10/18",
  "10/19", "10/20", "10/21", "10/22", "10/23", "10/24", "10/25",
];

/* ============================================================
   各页面数据
   ============================================================ */

/* ---------------- 内容库条目（五类 + 主题域 + 标签） ---------------- */

export interface Item {
  id: string;
  title: string;
  type: ContentType;
  topic: string;
  author: string;
  summary: string;
  tags: string[];
  status: string;
  updated: string;
}

export const items: Item[] = [
  { id: "g01", title: "用 AI 把部门周报自动化", type: "guide", topic: "ai", author: "林知", summary: "每周两小时拼周报，改成录音加提示词，十分钟出初稿", tags: ["入门", "自动化", "提示词"], status: "已发布", updated: "10-20" },
  { id: "g02", title: "给知识库加 RAG 问答", type: "guide", topic: "ai", author: "陈屿", summary: "从文档解析到向量检索，做一个能引用出处的问答", tags: ["进阶", "RAG", "检索"], status: "已发布", updated: "10-18" },
  { id: "g03", title: "用 Astro 做一个能上线的静态站", type: "guide", topic: "web", author: "陈屿", summary: "内容组织 + 构建 + 部署，一条完整路径", tags: ["入门", "Astro", "部署"], status: "已发布", updated: "10-24" },
  { id: "g04", title: "软著申请：从项目到材料", type: "guide", topic: "startup", author: "许川", summary: "把做过的东西变成一份能提交的软著材料", tags: ["实战", "软著", "材料"], status: "已发布", updated: "10-22" },
  { id: "s01", title: "把会议录音整理成纪要", type: "skill", topic: "ai", author: "陈屿", summary: "一段可直接粘给 agent 的指令，输出带待办和负责人", tags: ["可直接用", "会议"], status: "已发布", updated: "10-18" },
  { id: "s02", title: "把需求描述整理成开发任务", type: "skill", topic: "web", author: "周行", summary: "模糊需求 → 结构化任务清单 + 验收标准", tags: ["可直接用", "需求"], status: "已发布", updated: "10-15" },
  { id: "s03", title: "给代码写可读的提交说明", type: "skill", topic: "web", author: "叶明", summary: "按类型分组，让 review 的人一眼看懂改了什么", tags: ["入门", "协作"], status: "已发布", updated: "10-12" },
  { id: "t01", title: "课程大纲模板", type: "template", topic: "visual", author: "林知", summary: "一节课的目标 / 前置 / 步骤 / 练习结构", tags: ["教学", "可复用"], status: "已发布", updated: "10-16" },
  { id: "t02", title: "软著申请材料清单", type: "template", topic: "startup", author: "许川", summary: "逐项勾选，附常见退回原因", tags: ["软著", "清单"], status: "已发布", updated: "10-22" },
  { id: "t03", title: "需求登记表", type: "template", topic: "startup", author: "苏禾", summary: "接需求时先填这张表，避免反复沟通", tags: ["需求", "流程"], status: "已发布", updated: "10-10" },
  { id: "l01", title: "shadcn/ui", type: "link", topic: "web", author: "陈屿", summary: "可定制 React 组件，Tailwind 生态", tags: ["组件库", "React"], status: "已收录", updated: "10-19" },
  { id: "l02", title: "21st.dev", type: "link", topic: "web", author: "陈屿", summary: "社区手工打造的 React 组件与模板", tags: ["组件库", "模板"], status: "已收录", updated: "10-19" },
  { id: "tr01", title: "AI 工具工作坊 · 第二期", type: "training", topic: "ai", author: "林知", summary: "两小时动手场：带来一件重复劳动，带走一个能跑的流程", tags: ["报名中", "动手"], status: "报名中", updated: "10-26" },
  { id: "tr02", title: "AI 工具工作坊 · 第一期回放", type: "training", topic: "ai", author: "林知", summary: "两小时完整录像，现场把一个重复的活自动化", tags: ["回放", "录像"], status: "已归档", updated: "10-17" },
];

/* ---------------- 竞赛 ---------------- */

export interface Competition {
  id: string;
  name: string;
  level: string;
  host: string;
  status: string;
  tone: StatusTone;
  deadline: string;
  teams: number;
  members: string[];
}

export const competitions: Competition[] = [
  { id: "k01", name: "全国大学生机械创新设计大赛", level: "国家级", host: "教育部", status: "备赛中", tone: "warning", deadline: "11-10", teams: 2, members: ["苏禾", "顾言", "程野"] },
  { id: "k02", name: "中国软件杯大学生软件设计大赛", level: "国家级", host: "工信部", status: "报名中", tone: "info", deadline: "11-02", teams: 1, members: ["苏禾", "唐迟"] },
  { id: "k03", name: "蓝桥杯全国软件和信息技术专业人才大赛", level: "国家级", host: "工信部人才交流中心", status: "备赛中", tone: "warning", deadline: "11-15", teams: 3, members: ["陈屿", "周行", "程野"] },
  { id: "k04", name: "中国国际大学生创新大赛（互联网+）", level: "国家级", host: "教育部", status: "待核验", tone: "neutral", deadline: "11-20", teams: 1, members: ["许川"] },
];

/* ---------------- 活动 ---------------- */

export interface ActivityItem {
  id: string;
  title: string;
  kind: EventKind;
  date: string;
  place: string;
  status: string;
  tone: StatusTone;
  joined: number;
  capacity: number;
}

export const activityList: ActivityItem[] = [
  { id: "a01", title: "AI 工具工作坊 · 第二期", kind: "training", date: "10-29 19:00", place: "工训大楼 302", status: "报名中", tone: "info", joined: 24, capacity: 30 },
  { id: "a02", title: "技术部周会", kind: "meeting", date: "10-30 20:00", place: "线上", status: "待开始", tone: "neutral", joined: 4, capacity: 4 },
  { id: "a03", title: "竞赛经验分享会", kind: "sharing", date: "10-31 19:30", place: "工训大楼 201", status: "报名中", tone: "info", joined: 18, capacity: 40 },
  { id: "a04", title: "新成员见面会", kind: "activity", date: "11-01 14:00", place: "创客空间", status: "报名中", tone: "info", joined: 32, capacity: 40 },
  { id: "a05", title: "AI 工具工作坊 · 第一期", kind: "training", date: "10-17 19:00", place: "工训大楼 302", status: "已结束", tone: "neutral", joined: 28, capacity: 30 },
  { id: "a06", title: "竞赛部答辩预演", kind: "meeting", date: "10-14 20:00", place: "工训大楼 201", status: "已结束", tone: "neutral", joined: 6, capacity: 8 },
];

/* ---------------- 成果（完整） ---------------- */

export interface AwardDetail {
  id: string;
  title: string;
  level: string;
  competition: string;
  members: string[];
  date: string;
  hasCertificate: boolean;
}

export const awardList: AwardDetail[] = [
  { id: "aw01", title: "蓝桥杯省赛二等奖", level: "省级", competition: "蓝桥杯", members: ["程野", "周行"], date: "10-24", hasCertificate: true },
  { id: "aw02", title: "机械创新设计大赛省赛三等奖", level: "省级", competition: "全国大学生机械创新设计大赛", members: ["苏禾", "顾言"], date: "10-14", hasCertificate: true },
  { id: "aw03", title: "中国大学生计算机设计大赛国赛三等奖", level: "国家级", competition: "中国大学生计算机设计大赛", members: ["陈屿", "叶明"], date: "09-28", hasCertificate: true },
  { id: "aw04", title: "互联网+ 校赛一等奖", level: "校级", competition: "中国国际大学生创新大赛", members: ["许川", "唐迟"], date: "06-15", hasCertificate: false },
];

/**
 * 站点级配置：协会信息、导航、联系方式。
 * 业务数据都在 content/，页面不硬编码协会信息之外的业务内容。
 */
export const site = {
  name: '长理 AI 创客',
  nameEn: 'CSUST AI MAKER',
  short: 'AI 创客协会',
  fullName: '长沙理工大学 AI 创客协会',
  /** 站点对外地址 */
  url: 'https://an520.xin',
  /** 是否允许搜索引擎收录：真实成员名单与成果补齐后再开 */
  publicIndex: false,
  /** 数据状态：demo = 示例数据（页面显示提示）；real = 真实数据 */
  dataStatus: 'demo' as 'demo' | 'real',

  tagline: ['把 AI 用起来，', '把想法做出来。'],
  description:
    '长沙理工大学 AI 创客协会：展示协会活动与成果，记录每位成员做过的事，AI 汇总成可查的能力档案。',

  /** 主导航：只保留协会真正需要的四块 */
  nav: [
    { href: '/', label: '首页' },
    { href: '/achievements', label: '活动与成果' },
    { href: '/members', label: '成员能力' },
    { href: '/contribute', label: '提交记录' },
  ],

  contact: {
    email: 'hello@an520.xin',
    group: '长沙理工大学 AI 创客协会',
    address: '长沙理工大学云塘校区 · 科创港',
  },

  /** 协会简介（首页「关于协会」区与页脚共用） */
  about: {
    lead: '我们是一群在云塘校区科创港折腾 AI 的学生。',
    body: '协会围绕 AI 工具与工程实践做三件事：办活动与工作坊、做能落地的项目与竞赛、把每次做过的事沉淀成可复用的经验。这份站点用来展示协会的活动与成果，也用来记录每位成员做过什么、擅长什么。',
    facts: [
      { k: '所在位置', v: '长沙理工大学云塘校区 · 科创港' },
      { k: '在做的事', v: '活动 · 工作坊 · 项目 · 竞赛' },
      { k: '记录方式', v: '成员自己提交，AI 汇总能力档案' },
    ],
  },
} as const;

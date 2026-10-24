export const site = {
  name: '长理创客',
  nameEn: 'CSUST MAKER SPACE',
  short: '创客空间',
  tagline: ['把想法，', '做成东西。'],
  description:
    '长沙理工大学创客空间 · 技术分享与服务平台。我们做课程、带竞赛、接需求，也把做过的东西整理成能直接拿去用的技能。',
  nav: [
    { href: '/', label: '首页' },
    { href: '/library', label: '内容库' },
    { href: '/members', label: '成员' },
    { href: '/services', label: '服务台' },
    { href: '/stats', label: '数据' },
    { href: '/about', label: '关于' },
  ],
  contact: {
    email: 'hello@an520.xin',
    group: '创客空间 · 技术部',
    address: '长沙理工大学云塘校区 · 工训大楼',
  },
  // 首页三入口
  entries: [
    {
      num: '01',
      href: '/library',
      icon: '◈',
      title: '看成果',
      desc: '项目、竞赛、活动、课程，做过的都在这里。每个都有参与人、状态和可复用的产出。',
      go: '进入内容库',
    },
    {
      num: '02',
      href: '/services',
      icon: '◇',
      title: '找服务',
      desc: '培训、组队、素材、演示、软著材料。说清楚需求，我们按约定节奏交付，不包办。',
      go: '提交需求',
    },
    {
      num: '03',
      href: '/library?type=course',
      icon: '△',
      title: '学技能',
      desc: '技术部的课程和模板。每个都能直接拿走用，不是看一遍就忘的文章。',
      go: '开始学',
    },
  ],
};

export const stats = [
  { k: '在册成员', v: 32, unit: '人' },
  { k: '内容条目', v: 12, unit: '条' },
  { k: '已交付需求', v: 18, unit: '项' },
  { k: '竞赛获奖', v: 9, unit: '项' },
];

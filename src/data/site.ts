import { items } from './items';
import { members } from './members';
import { publishedItems } from './validate';

export const site = {
  name: '长理创客',
  nameEn: 'CSUST MAKER SPACE',
  short: '创客空间',
  tagline: ['把想法，', '做成东西。'],
  description:
    '长沙理工大学创客空间的内部知识库。攻略、技能指令、模板、外部项目、培训，每条都留下能直接拿走用的东西。',
  nav: [
    { href: '/', label: '首页' },
    { href: '/library', label: '内容库' },
    { href: '/members', label: '成员' },
    { href: '/resources', label: '资源' },
    { href: '/stats', label: '数据' },
    { href: '/about', label: '关于' },
  ],
  /** 反馈收集端点（飞书 Webhook / 表单地址）。留空则只记录在本地。 */
  feedbackEndpoint: '',
  contact: {
    email: 'hello@an520.xin',
    group: '创客空间 · 技术部',
    address: '长沙理工大学云塘校区 · 工训大楼',
  },
  // 首页三入口
  entries: [
    { num: '01', href: '/library?type=guide', icon: '攻', title: '攻略', desc: '问题场景、现成路径、可复制提示词、我们自己的使用记录。', go: '看攻略' },
    { num: '02', href: '/library?type=skill', icon: '令', title: '技能指令', desc: '一段能直接复制给 agent 的指令，粘上就能用。', go: '拿指令' },
    { num: '03', href: '/library?type=template', icon: '模', title: '模板素材', desc: '课程大纲、README、软著清单、需求登记表，直接下载。', go: '去下载' },
    { num: '04', href: '/library?type=link', icon: '链', title: '外部项目', desc: '筛过的开源项目和外部资源，点开直达原文。', go: '看项目' },
    { num: '05', href: '/library?type=training', icon: '训', title: '培训', desc: '线下培训的通知、报名和结束后的档案。', go: '看培训' },
  ],
};

/** 数据带：从真实内容推导，不再手填 */
const live = publishedItems(items);
const ACTIVE_STATES = ['进行中', '备赛中', '报名中'];
export const stats = [
  { k: '在册成员', v: members.length, unit: '人' },
  { k: '内容条目', v: live.length, unit: '条' },
  { k: '攻略收录', v: live.filter((i) => i.type === 'guide').length, unit: '篇' },
  { k: '进行中', v: live.filter((i) => ACTIVE_STATES.includes(i.status)).length, unit: '项' },
];

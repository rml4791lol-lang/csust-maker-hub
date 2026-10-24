export interface Service {
  id: string;
  title: string;
  desc: string;
  deliverable: string;
  sla: string;
  owner: string;
  /** 谁能提 */
  for: string;
}

export const services: Service[] = [
  {
    id: 's01',
    title: 'AI 工具选型咨询',
    desc: '你们部门想用 AI 干活，但不知道选什么工具、花多少钱、数据放哪安全。',
    deliverable: '一份选型清单 + 上手步骤',
    sla: '3 个工作日',
    owner: '技术部',
    for: '所有部门',
  },
  {
    id: 's02',
    title: 'AI 工作流定制',
    desc: '把一件重复劳动拆开，做成能一句话触发的流程。',
    deliverable: '一个可运行的技能包（含提示词和步骤）',
    sla: '5 个工作日',
    owner: '技术部',
    for: '所有部门',
  },
  {
    id: 's03',
    title: '培训 / 工作坊',
    desc: '按你们真实要做的活设计，不是通用讲座。',
    deliverable: '一次 2 小时的动手场 + 录屏 + 课程包',
    sla: '提前 1 周预约',
    owner: '技术部',
    for: '所有部门',
  },
  {
    id: 's04',
    title: '内容代做：海报 / 推文 / 视频 / 数据',
    desc: '临时缺人手的宣传物料和数据处理，我们接，但需要你们给清需求。',
    deliverable: '成品文件 + 源文件',
    sla: '按工作量约定',
    owner: '宣传部 · 技术部',
    for: '所有部门',
  },
  {
    id: 's05',
    title: '竞赛组队与材料支撑',
    desc: '国赛省赛的组队、技术方案、答辩材料和演示页面。',
    deliverable: '队伍 + 技术材料 + 演示页',
    sla: '按赛程倒排',
    owner: '竞赛部',
    for: '竞赛部对接',
  },
  {
    id: 's06',
    title: '软著 / 专利技术材料',
    desc: '把已落地的项目整理成软著申请材料，或配合专利技术交底。',
    deliverable: '材料初稿 + 模板 + 退回意见处理',
    sla: '7 个工作日',
    owner: '技术部 · 创新创业部',
    for: '所有部门',
  },
];

export interface Demand {
  id: string;
  title: string;
  dept: string;
  status: '待接' | '处理中' | '已交付';
  date: string;
}

/** 需求看板示例数据，正式环境从飞书表同步 */
export const demands: Demand[] = [
  { id: 'd01', title: '宣传部需要 3 张招新海报的模板', dept: '宣传部', status: '已交付', date: '2026-10-18' },
  { id: 'd02', title: '竞赛部要一个省赛答辩演示页', dept: '竞赛部', status: '处理中', date: '2026-10-21' },
  { id: 'd03', title: '创新创业部想批量生成软著说明书', dept: '创新创业部', status: '待接', date: '2026-10-23' },
];

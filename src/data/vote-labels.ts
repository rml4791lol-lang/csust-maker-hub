/**
 * 反馈投票标签的单一来源：后台反馈汇总（admin-server）、每日简报（daily-brief）、
 * 详情页客户端脚本（library/[id].astro）共用，改文案只改这里。
 * 纯数据模块，不引入任何 node 依赖——客户端也会打包它。
 */
export const voteLabel = { useful: '有用', useless: '没用', confirmed: '照做出来了' } as const;

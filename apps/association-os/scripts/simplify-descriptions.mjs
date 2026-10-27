// 精简页面描述：去掉「按级别陈列 / 像一本年鉴 / 按天排布」这类解释性 AI 味文案
import fs from "node:fs";
import path from "node:path";

const edits = [
  [
    "library",
    'description="攻略、技能指令、模板素材、外部项目、培训 —— 每条都带现成路径和能直接拿走的东西。"',
    "",
  ],
  ["admin", 'description="内容审核 · 成员管理 · 系统状态"', ""],
  [
    "members",
    "description={`${members.length} 名在册成员，分属 ${departments.length} 个部门。按编号排列，像一本年鉴。`}",
    "description={`${members.length} 名在册成员 · ${departments.length} 个部门`}",
  ],
  [
    "activities",
    "description={`本周 ${weekRange} · ${activityList.length} 场活动，按天排布。`}",
    "description={`${weekRange} · ${activityList.length} 场活动`}",
  ],
  [
    "projects",
    "description={`${projects.length} 个项目，沿「立项 → 开发中 → 答辩准备 → 已结项 → 孵化中」五段轨道推进。`}",
    "description={`${projects.length} 个项目 · 5 个阶段`}",
  ],
  [
    "competitions",
    "description={`${competitions.length} 场赛事 · ${totalTeams} 支参赛队伍。按截止日排序，最紧迫的排最前。`}",
    "description={`${competitions.length} 场赛事 · ${totalTeams} 支队伍`}",
  ],
  [
    "achievements",
    "description={`${awardList.length} 项获奖记录，其中 ${certCount} 项附有证明。按级别陈列。`}",
    "description={`${awardList.length} 项获奖 · ${certCount} 项已归档`}",
  ],
];

for (const [p, from, to] of edits) {
  const f = path.join("src", "app", p, "page.tsx");
  let c = fs.readFileSync(f, "utf8");
  if (!c.includes(from)) {
    console.log("NOT FOUND:", p);
    continue;
  }
  c = c.replace(from, to);
  // 删除空描述后残留的空行
  c = c.replace(/\n\s*\n(\s*\/>)/g, "\n$1");
  fs.writeFileSync(f, c, "utf8");
  console.log("updated:", p);
}

// 「实践记录」→「日志」（功能本质：什么时候做了什么 + 可上传材料）
import fs from "node:fs";

const files = [
  "src/lib/admin-schema.ts",
  "src/components/dashboard.tsx",
  "src/lib/dashboard-data.ts",
  "src/lib/mock-data.ts",
  "src/lib/workflow.ts",
  "src/app/api/contributions/route.ts",
];

const replacements = [
  ["实践记录状态", "日志状态"],
  ["实践记录（成员自助）", "日志（成员自助）"],
  ["实践记录", "日志"],
  ["本月记录", "本月记录"], // 部门统计保留
];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let c = fs.readFileSync(f, "utf8");
  const before = c;
  for (const [from, to] of replacements) c = c.split(from).join(to);
  if (c !== before) {
    fs.writeFileSync(f, c, "utf8");
    console.log("updated:", f);
  }
}

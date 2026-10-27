// 把「贡献」相关 UI 文案改为「实践记录」（去掉功利/考核感）
import fs from "node:fs";

const files = [
  "src/lib/admin-schema.ts",
  "src/components/dashboard.tsx",
  "src/lib/dashboard-data.ts",
  "src/lib/mock-data.ts",
  "src/lib/workflow.ts",
  "src/app/about/page.tsx",
  "src/app/api/contributions/route.ts",
  "src/app/api/admin/clear-data/route.ts",
];

const replacements = [
  ["贡献上报状态", "实践记录状态"],
  ["贡献上报（成员自助）", "实践记录（成员自助）"],
  ["贡献上报", "实践记录"],
  ["本月贡献", "本月记录"],
  ["贡献", "记录"],
];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let c = fs.readFileSync(f, "utf8");
  const before = c;
  for (const [from, to] of replacements) {
    c = c.split(from).join(to);
  }
  if (c !== before) {
    fs.writeFileSync(f, c, "utf8");
    console.log("updated:", f);
  }
}

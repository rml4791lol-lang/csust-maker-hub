// 卡片统一换成 .panel（浮起质感：顶部受光 + 内高光 + 双层软投影）
import fs from "node:fs";

const files = [
  "src/app/projects/page.tsx",
  "src/components/ui/stat-card.tsx",
  "src/components/dashboard.tsx",
  "src/app/competitions/page.tsx",
  "src/app/admin/page.tsx",
  "src/app/activities/page.tsx",
  "src/app/library/page.tsx",
  "src/app/members/page.tsx",
  "src/app/about/page.tsx",
];

let n = 0;
for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log("missing:", f);
    continue;
  }
  let c = fs.readFileSync(f, "utf8");
  const before = c;
  c = c.replace(/rounded-lg border border-border bg-surface-2/g, "panel");
  if (c !== before) {
    fs.writeFileSync(f, c, "utf8");
    n++;
    console.log("patched:", f);
  }
}
console.log("total:", n);

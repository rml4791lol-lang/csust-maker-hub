// 给读数据库的页面加动态渲染（await connection()）
import fs from "node:fs";

const files = [
  "src/app/projects/page.tsx",
  "src/app/achievements/page.tsx",
  "src/app/about/page.tsx",
];

for (const f of files) {
  let c = fs.readFileSync(f, "utf8");
  if (c.includes("await connection()")) {
    console.log("skip:", f);
    continue;
  }
  const before = c;
  c = c.replace(
    /export default function (\w+Page)\(\) \{/,
    "export default async function $1() {\n  await connection();",
  );
  if (c === before) {
    console.log("NO MATCH:", f);
    continue;
  }
  fs.writeFileSync(f, c, "utf8");
  console.log("patched:", f);
}

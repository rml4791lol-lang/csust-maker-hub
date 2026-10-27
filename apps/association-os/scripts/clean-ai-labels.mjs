// 清除 AI 味装饰：页面编号（07 / ACHIEVEMENTS）、解释性描述后缀
import fs from "node:fs";
import path from "node:path";

const pages = [
  "library",
  "members",
  "competitions",
  "projects",
  "activities",
  "achievements",
  "about",
  "admin",
];

for (const p of pages) {
  const f = path.join("src", "app", p, "page.tsx");
  if (!fs.existsSync(f)) continue;
  let c = fs.readFileSync(f, "utf8");
  const before = c;

  // 1) 删除 index="xx / YYYY" 装饰编号
  c = c.replace(/\s*index="[^"]*"/g, "");

  if (c !== before) {
    fs.writeFileSync(f, c, "utf8");
    console.log("cleaned index:", p);
  }
}

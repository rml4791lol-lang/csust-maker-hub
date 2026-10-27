// 放大容器宽度 + 压缩垂直空白，减少两侧/上下死黑
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
  if (!fs.existsSync(f)) {
    console.log("skip (missing):", p);
    continue;
  }
  let c = fs.readFileSync(f, "utf8");
  const before = c;

  c = c.replace(/max-w-\[1280px\]/g, "max-w-[1560px]");
  c = c.replace(/max-w-\[1320px\]/g, "max-w-[1560px]");
  c = c.replace(/max-w-\[1000px\]/g, "max-w-[1180px]");
  c = c.replace(/px-6 py-10/g, "px-8 py-8");

  if (c !== before) {
    fs.writeFileSync(f, c, "utf8");
    console.log("updated:", p);
  } else {
    console.log("no change:", p);
  }
}

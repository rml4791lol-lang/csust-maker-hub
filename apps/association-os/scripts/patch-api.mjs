// 批量把 API 路由改为：ensureDynamic() + json() helper（ESM）
import fs from "node:fs";
import path from "node:path";

const apiDir = path.join("src", "app", "api");
const dirs = fs
  .readdirSync(apiDir)
  .filter((d) => fs.statSync(path.join(apiDir, d)).isDirectory());

let changed = 0;
for (const d of dirs) {
  const file = path.join(apiDir, d, "route.ts");
  if (!fs.existsSync(file)) continue;
  let c = fs.readFileSync(file, "utf8");
  const before = c;

  c = c.replace(
    /import \{ NextResponse \} from "next\/server";/,
    'import { ensureDynamic, json } from "@/lib/api";',
  );
  c = c.replace(/NextResponse\.json\(/g, "json(");
  c = c.replace(
    /export async function GET\(\) \{\n/,
    "export async function GET() {\n  await ensureDynamic();\n",
  );

  if (c !== before) {
    fs.writeFileSync(file, c, "utf8");
    changed++;
  }
  console.log("processed:", d);
}
console.log("changed:", changed);

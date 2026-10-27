import { ensureDynamic, json } from "@/lib/api";
import { getMeta } from "@/lib/db";

/** 数据来源标记（公开）：前台可据此提示「示例数据」 */
export async function GET() {
  await ensureDynamic();
  const meta = getMeta();
  return json({
    dataSource: meta.data_source ?? "unknown",
    seededAt: meta.seeded_at ?? null,
    schemaVersion: meta.schema_version ?? null,
  });
}

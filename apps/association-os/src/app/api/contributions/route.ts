import { ensureDynamic, json } from "@/lib/api";
import { adminWriteError } from "@/lib/admin-auth";
import {
  createFootprint,
  footprintRetryAfter,
  listPublicFootprints,
  validateFootprintInput,
} from "@/lib/footprint-service";

/** 旧 JSON 入口与足迹页面共享公开范围。 */
export async function GET() {
  await ensureDynamic();
  return json(listPublicFootprints(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  await ensureDynamic();
  const denied = await adminWriteError(request);
  if (denied) return json({ error: denied.error }, { status: denied.status, headers: { "Cache-Control": "private, no-store" } });
  const retryAfter = footprintRetryAfter(request);
  if (retryAfter) {
    return json(
      { error: "提交过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, { status: 400 });
  }
  const result = validateFootprintInput(body);
  if (result.error !== undefined) return json({ error: result.error }, { status: 400 });
  try {
    return json(createFootprint(result.value), { status: 201 });
  } catch (error) {
    console.error("[contributions] create failed:", error);
    return json({ error: "足迹保存失败，请稍后重试" }, { status: 500 });
  }
}

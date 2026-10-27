import { ensureDynamic, json } from "@/lib/api";
import { MAX_SIZE, saveUpload } from "@/lib/uploads";
import {
  createFootprint,
  footprintRetryAfter,
  listPublicFootprints,
  validateFootprintInput,
  type FootprintAttachment,
} from "@/lib/footprint-service";

export async function GET() {
  await ensureDynamic();
  return json(listPublicFootprints(), { headers: { "Cache-Control": "no-store" } });
}

/** 公开提交一条足迹（含可选附件），提交即公开。 */
export async function POST(request: Request) {
  await ensureDynamic();
  const retryAfter = footprintRetryAfter(request);
  if (retryAfter) {
    return json(
      { error: "提交过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "表单格式错误" }, { status: 400 });
  }
  const result = validateFootprintInput({
    member: form.get("member"), content: form.get("content"), date: form.get("date"),
    project: form.get("project"), dept: form.get("dept"), hours: form.get("hours"),
  });
  if (result.error !== undefined) return json({ error: result.error }, { status: 400 });
  const file = form.get("file");
  let attachment: FootprintAttachment | null = null;
  if (file && file instanceof File && file.size > 0) {
    if (file.size > MAX_SIZE) {
      return json({ error: "文件超过 5MB" }, { status: 400 });
    }
    try {
      attachment = saveUpload(Buffer.from(await file.arrayBuffer()), file.name, file.type);
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "附件保存失败" },
        { status: 400 },
      );
    }
  }
  try {
    return json(createFootprint(result.value, attachment), { status: 201 });
  } catch (error) {
    console.error("[footprints] create failed:", error);
    return json({ error: "足迹保存失败，请稍后重试" }, { status: 500 });
  }
}

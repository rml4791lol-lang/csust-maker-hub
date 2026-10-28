import { ensureDynamic, json } from "@/lib/api";
import { adminWriteError } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { MEDIA_TYPES, MediaError, readBoundedImage, saveMedia } from "@/lib/media-storage";

// Single-admin, per-process limit. Proxy headers cannot mint new rate buckets.
const scope = globalThis as typeof globalThis & { __associationMediaRate?: { start: number; count: number } };

export async function POST(request: Request) {
  await ensureDynamic();
  const denied = await adminWriteError(request);
  if (denied) return json({ error: denied.error }, { status: denied.status });
  const now = Date.now();
  if (!scope.__associationMediaRate || now - scope.__associationMediaRate.start >= 60_000) scope.__associationMediaRate = { start: now, count: 0 };
  if (++scope.__associationMediaRate.count > 30) return json({ error: "上传较频繁，请稍后重试" }, { status: 429, headers: { "Retry-After": "60" } });
  const mime = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  if (!MEDIA_TYPES.some(type => type === mime)) return json({ error: "仅支持 PNG、JPEG 或 WebP 图片" }, { status: 400 });
  try {
    const buffer = await readBoundedImage(request);
    const asset = await saveMedia(getDb(), buffer, mime, new URL(request.url).searchParams.get("name") ?? "");
    return json(asset, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MediaError) return json({ error: error.message }, { status: error.status });
    console.error("[media] upload failed", error);
    return json({ error: "图片上传失败，请稍后重试" }, { status: 500 });
  }
}

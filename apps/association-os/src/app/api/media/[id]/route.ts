import { ensureDynamic, json } from "@/lib/api";
import { isAdminRequest } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { MEDIA_ID_PATTERN } from "@/lib/article-media";
import { PUBLIC_ITEM_STATUS_SQL } from "@/lib/public-records";
import { readMedia, type MediaAsset } from "@/lib/media-storage";

const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDynamic();
  const { id } = await params;
  const missing = () => json({ error: "图片不存在" }, { status: 404, headers });
  if (!MEDIA_ID_PATTERN.test(id)) return missing();
  const db = getDb();
  const asset = db.prepare("SELECT * FROM media_assets WHERE id = ?").get(id) as unknown as MediaAsset | undefined;
  if (!asset) return missing();
  const publicReference = db.prepare(`SELECT 1 FROM item_media JOIN items ON items.id = item_media.item_id WHERE media_id = ? AND body_format = 'markdown' AND ${PUBLIC_ITEM_STATUS_SQL} LIMIT 1`).get(id);
  if (!publicReference && !await isAdminRequest(request)) return missing();
  const buffer = await readMedia(asset);
  if (!buffer) return missing();
  return new Response(new Uint8Array(buffer), { headers: { ...headers, "Content-Type": asset.mime, "Content-Length": String(buffer.length), "Content-Disposition": "inline" } });
}

import { ensureDynamic } from "@/lib/api";
import { readUpload } from "@/lib/uploads";
import { getDb } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";

/** 公开：读取足迹附件 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  await ensureDynamic();
  const { name } = await params;
  const cacheHeaders = { "Cache-Control": "private, no-store" };
  const visible = getDb()
    .prepare(
      `SELECT 1 FROM contributions
       WHERE attachment_path = ? AND (status = 'approved' OR ? = 1)
       LIMIT 1`,
    )
    .get(name, await isAdminRequest(request) ? 1 : 0);
  if (!visible) return new Response("Not found", { status: 404, headers: cacheHeaders });
  const file = readUpload(name);
  if (!file) {
    return new Response("Not found", { status: 404, headers: cacheHeaders });
  }

  return new Response(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.type,
      "Content-Length": String(file.buffer.length),
      ...cacheHeaders,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}

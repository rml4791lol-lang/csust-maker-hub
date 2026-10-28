import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import sharp from "sharp";

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
export const MAX_MEDIA_PIXELS = 20_000_000;
export const MAX_MEDIA_EDGE = 8192;
export const MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
type MediaType = typeof MEDIA_TYPES[number];
export class MediaError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export interface MediaAsset {
  id: string; storage_name: string; mime: MediaType; size: number;
  width: number; height: number; original_name: string; created_at: string;
}

/** New media always follows the same configured data directory as the database. */
export function mediaDirectory() {
  return path.join(path.resolve(/* turbopackIgnore: true */ process.env.AI_ASSOCIATION_DATA_DIR || path.join(process.cwd(), "data")), "media");
}

export async function readBoundedImage(request: Request): Promise<Buffer> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_MEDIA_BYTES) throw new MediaError("图片不能超过 5 MiB", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new MediaError("请选择图片");
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_MEDIA_BYTES) {
        await reader.cancel();
        throw new MediaError("图片不能超过 5 MiB", 413);
      }
      chunks.push(Buffer.from(next.value));
    }
  } finally { reader.releaseLock(); }
  if (!size) throw new MediaError("图片文件为空");
  return Buffer.concat(chunks, size);
}

function signature(buffer: Buffer): MediaType | null {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return "image/jpeg";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

function isAnimatedPng(buffer: Buffer) {
  // libvips may decode only the first APNG frame; inspect actual PNG chunks too.
  for (let offset = 8; offset + 12 <= buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    if (buffer.toString("ascii", offset + 4, offset + 8) === "acTL") return true;
    offset += length + 12;
  }
  return false;
}

export async function decodeMedia(buffer: Buffer, declaredMime: string) {
  if (!MEDIA_TYPES.includes(declaredMime as MediaType)) throw new MediaError("仅支持 PNG、JPEG 或 WebP 图片");
  if (buffer.length > MAX_MEDIA_BYTES) throw new MediaError("图片不能超过 5 MiB", 413);
  const mime = signature(buffer);
  if (!mime || mime !== declaredMime) throw new MediaError("图片类型与文件内容不符");
  try {
    const decoder = sharp(buffer, { limitInputPixels: MAX_MEDIA_PIXELS, failOn: "warning", animated: true });
    const metadata = await decoder.metadata();
    if ((metadata.pages ?? 1) !== 1 || mime === "image/png" && isAnimatedPng(buffer)) throw new MediaError("暂不支持动态图片");
    if (!metadata.width || !metadata.height || metadata.width > MAX_MEDIA_EDGE || metadata.height > MAX_MEDIA_EDGE || metadata.width * metadata.height > MAX_MEDIA_PIXELS) {
      throw new MediaError("图片尺寸不能超过 2000 万像素或单边 8192 像素", 413);
    }
    const oriented = decoder.rotate();
    const encoder = mime === "image/png" ? oriented.png()
      : mime === "image/jpeg" ? oriented.jpeg({ quality: 90 }) : oriented.webp({ quality: 90 });
    // Re-encoding strips metadata and trailing bytes; never serve the source file.
    const { data, info } = await encoder.toBuffer({ resolveWithObject: true });
    if (data.length > MAX_MEDIA_BYTES) throw new MediaError("处理后的图片超过 5 MiB，请压缩后重试", 413);
    return { data, mime, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof MediaError) throw error;
    if (error instanceof Error && error.message.includes("Input image exceeds pixel limit")) {
      throw new MediaError("图片尺寸不能超过 2000 万像素", 413);
    }
    throw new MediaError("图片无法解码或尺寸过大，请换一张图片");
  }
}

export async function saveMedia(db: DatabaseSync, buffer: Buffer, mime: string, name: string) {
  const decoded = await decodeMedia(buffer, mime);
  const id = randomBytes(16).toString("hex");
  const extension = decoded.mime === "image/jpeg" ? "jpg" : decoded.mime.slice(6);
  const storageName = `${id}.${extension}`;
  const directory = mediaDirectory();
  const filename = path.join(directory, storageName);
  await mkdir(directory, { recursive: true });
  const file = await open(filename, "wx", 0o600);
  const originalName = name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200).trim() || `图片.${extension}`;
  try {
    await file.writeFile(decoded.data);
    await file.close();
    db.prepare("INSERT INTO media_assets (id,storage_name,mime,size,width,height,original_name,created_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(id, storageName, decoded.mime, decoded.data.length, decoded.width, decoded.height, originalName, new Date().toISOString());
  } catch (error) {
    // Compensate only this exclusive newly-created file. Never delete old assets.
    await file.close().catch(() => {});
    await unlink(filename).catch(() => {});
    throw error;
  }
  return { id, url: `/api/media/${id}`, name: originalName, width: decoded.width, height: decoded.height, size: decoded.data.length, mime: decoded.mime };
}

export async function readMedia(asset: MediaAsset): Promise<Buffer | null> {
  if (!/^[a-f0-9]{32}\.(png|jpg|webp)$/.test(asset.storage_name)) return null;
  try { return await readFile(path.join(mediaDirectory(), asset.storage_name)); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

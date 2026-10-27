// ============================================================
// 文件上传：本地存储 + 类型/大小校验 + 随机文件名
// ============================================================

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

/** 允许的类型 → 扩展名映射 */
export const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

/** 单文件上限 5MB */
export const MAX_SIZE = 5 * 1024 * 1024;

export function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/** 保存文件，返回存储信息（随机文件名，防路径穿越） */
export function saveUpload(
  buffer: Buffer,
  originalName: string,
  mime: string,
): {
  name: string;
  path: string;
  size: number;
  type: string;
} {
  const ext = ALLOWED_TYPES[mime];
  if (!ext) throw new Error("不支持的文件类型");
  if (buffer.length > MAX_SIZE) throw new Error("文件超过 5MB");

  ensureUploadDir();
  const stored = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), buffer);

  return {
    name: originalName.slice(0, 120),
    path: stored,
    size: buffer.length,
    type: mime,
  };
}

/** 读取已上传文件（仅允许合法文件名，防穿越） */
export function readUpload(storedName: string): {
  buffer: Buffer;
  type: string;
} | null {
  // 只允许 32 位 hex + 扩展名
  if (!/^[a-f0-9]{32}\.(png|jpg|webp|gif|pdf)$/.test(storedName)) {
    return null;
  }
  const full = path.join(UPLOAD_DIR, storedName);
  if (!fs.existsSync(full)) return null;

  const ext = storedName.split(".").pop();
  const type =
    Object.entries(ALLOWED_TYPES).find(([, e]) => e === ext)?.[0] ??
    "application/octet-stream";

  return { buffer: fs.readFileSync(full), type };
}

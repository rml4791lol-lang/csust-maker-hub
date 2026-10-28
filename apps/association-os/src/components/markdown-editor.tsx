"use client";

import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { useAdminAuth } from "@/components/admin-auth-provider";
import { MarkdownContent } from "@/components/markdown-content";

type Props = {
  id: string;
  value: string;
  format: string;
  onChange: (value: string) => void;
  onFormatChange: (format: "markdown") => void;
  onUploadingChange: (uploading: boolean) => void;
  disabled?: boolean;
  maxLength?: number;
  describedBy?: string;
  invalid?: boolean;
};
type MediaResult = { url?: string; error?: string };
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const TOOL = "min-h-11 rounded px-3 text-sm text-foreground-secondary hover:bg-surface-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

export function MarkdownEditor({ id, value, format, onChange, onFormatChange, onUploadingChange, disabled = false, maxLength = 50000, describedBy, invalid }: Props) {
  const { requireAdmin } = useAdminAuth();
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryFiles, setRetryFiles] = useState<File[]>([]);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  const selection = useRef({ start: value.length, end: value.length });
  const uploadController = useRef<AbortController | null>(null);
  const markdown = format === "markdown";

  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => () => {
    uploadController.current?.abort();
    uploadController.current = null;
    // Activity may preserve this component's state after cancelling its effects.
    setUploading(false);
    onUploadingChange(false);
  }, [onUploadingChange]);

  function update(next: string, start?: number, end?: number) {
    if (next.length > maxLength) { setError(`正文不能超过 ${maxLength.toLocaleString()} 字。请删减后再插入内容。`); return false; }
    valueRef.current = next;
    onChange(next);
    setNotice("");
    if (start !== undefined) {
      selection.current = { start, end: end ?? start };
      requestAnimationFrame(() => {
        textarea.current?.focus();
        textarea.current?.setSelectionRange(start, end ?? start);
      });
    }
    return true;
  }

  function rememberSelection() {
    if (textarea.current) selection.current = { start: textarea.current.selectionStart, end: textarea.current.selectionEnd };
  }

  function insert(before: string, after = "", fallback = "") {
    const source = valueRef.current;
    const { start, end } = selection.current;
    const selected = source.slice(start, end) || fallback;
    const next = source.slice(0, start) + before + selected + after + source.slice(end);
    const cursorStart = start + before.length;
    if (update(next, cursorStart, cursorStart + selected.length)) setError("");
  }

  async function upload(files: File[]) {
    if (uploadController.current || disabled || !files.length) return;
    const controller = new AbortController();
    uploadController.current = controller;
    setUploading(true); onUploadingChange(true); setError(""); setNotice(""); setRetryFiles([]);
    let done = 0;
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        try {
          if (!IMAGE_TYPES.has(file.type)) throw new Error("请上传 PNG、JPEG 或 WebP 静态图片。");
          if (file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error("每张图片应大于 0 字节，且不超过 5 MB。");
          const response = await fetch(`/api/admin/media?name=${encodeURIComponent(file.name)}`, {
            method: "POST", headers: { "Content-Type": file.type }, body: file, signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          if (response.status === 401) {
            void requireAdmin(() => setNotice("已重新登录，请点击重试上传。正文仍保留。"));
            throw new Error("登录已失效，正文和待传图片已保留。重新登录后请重试上传。");
          }
          const payload: unknown = await response.json().catch(() => null);
          if (controller.signal.aborted) return;
          if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("图片上传失败，请稍后重试。");
          const result = payload as MediaResult;
          if (!response.ok) throw new Error(result.error || "图片上传失败，请重试。");
          if (!result.url || !/^\/api\/media\/[a-f0-9]{32}$/.test(result.url)) throw new Error("上传响应无效，正文已保留，请重试。");
          const source = valueRef.current;
          const { start, end } = selection.current;
          const alt = file.name.replace(/\.[^.]+$/, "").replace(/[\[\]\\\r\n]/g, " ").trim() || "图片说明";
          const image = `\n\n![${alt}](${result.url})\n\n`;
          if (!update(source.slice(0, start) + image + source.slice(end), start + image.length)) return;
          done += 1;
        } catch (cause) {
          if (!controller.signal.aborted) {
            setError(cause instanceof Error ? cause.message : "图片上传失败，正文已保留，请重试。");
            setRetryFiles(files.slice(index));
          }
          return;
        }
      }
      if (done) setNotice(`已插入 ${done} 张图片。可切换到预览检查排版。`);
    } finally {
      if (uploadController.current === controller) {
        uploadController.current = null;
        setUploading(false); onUploadingChange(false);
      }
    }
  }

  function paste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.items).filter((item) => item.kind === "file").map((item) => item.getAsFile()).filter((file): file is File => file !== null);
    if (!files.length || !markdown) return;
    event.preventDefault();
    if (uploading) { setNotice("图片正在上传，请完成后再粘贴下一组。"); return; }
    rememberSelection();
    void upload(files);
  }

  return <div className="mt-2 min-w-0">
    {!markdown && <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-2 border-border-strong pl-4">
      <p className="text-sm leading-relaxed text-foreground-secondary">此篇保留原有纯文本。启用图文编辑后，可插入图片并使用标题等格式。</p>
      <button type="button" disabled={disabled} onClick={() => onFormatChange("markdown")} className="min-h-11 text-base font-medium text-primary">启用图文编辑</button>
    </div>}
    <div className="overflow-hidden rounded-md border border-border-strong bg-surface-1 focus-within:border-primary">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-2">
        <div aria-label="正文显示方式" className="flex">
          <button type="button" aria-pressed={mode === "write"} onClick={() => setMode("write")} className={`min-h-12 border-b-2 px-4 text-base ${mode === "write" ? "border-primary font-medium text-foreground" : "border-transparent text-foreground-secondary"}`}>写作</button>
          <button type="button" aria-pressed={mode === "preview"} onClick={() => setMode("preview")} className={`min-h-12 border-b-2 px-4 text-base ${mode === "preview" ? "border-primary font-medium text-foreground" : "border-transparent text-foreground-secondary"}`}>预览</button>
        </div>
        <span className="px-2 text-sm text-foreground-secondary">{value.length.toLocaleString()} / {maxLength.toLocaleString()} 字</span>
      </div>
      {markdown && mode === "write" && <div role="group" aria-label="正文格式" className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1">
        <button type="button" disabled={disabled} onClick={() => insert("\n## ", "\n", "小节标题")} className={TOOL}>标题</button>
        <button type="button" disabled={disabled} onClick={() => insert("**", "**", "加粗文字")} className={TOOL}>加粗</button>
        <button type="button" disabled={disabled} onClick={() => insert("\n- ", "\n", "列表内容")} className={TOOL}>列表</button>
        <button type="button" disabled={disabled} onClick={() => insert("\n> ", "\n", "引用内容")} className={TOOL}>引用</button>
        <button type="button" disabled={disabled} onClick={() => insert("[", "](https://example.com)", "链接文字")} className={TOOL}>链接</button>
        <button type="button" disabled={disabled} onClick={() => insert("\n```\n", "\n```\n", "代码")} className={TOOL}>代码</button>
        <button type="button" disabled={disabled || uploading} onClick={() => picker.current?.click()} className={`${TOOL} font-medium text-primary`}>{uploading ? "正在上传…" : "插入图片"}</button>
      </div>}
      {mode === "write" ? <textarea
        ref={textarea} id={id} name="body" data-field="body" rows={14} maxLength={maxLength}
        value={value} disabled={disabled} onChange={(event) => { update(event.target.value); rememberSelection(); }}
        onSelect={rememberSelection} onPaste={paste} aria-describedby={[describedBy, `${id}-help`].filter(Boolean).join(" ")}
        aria-invalid={invalid || undefined} placeholder="写下经验、方法与实践记录…"
        className="block min-h-80 w-full resize-y bg-transparent px-4 py-4 text-base leading-loose text-foreground outline-none placeholder:text-foreground-muted disabled:opacity-60 sm:px-5"
      /> : <div aria-label="正文预览" className="min-h-80 px-4 py-5 sm:px-5">{value.trim() ? <MarkdownContent body={value} format={format} /> : <p className="text-base text-foreground-secondary">写下正文后，可以在这里查看排版。</p>}</div>}
    </div>
    <input ref={picker} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void upload(files); }} />
    <p id={`${id}-help`} className="mt-3 text-sm leading-relaxed text-foreground-secondary">{markdown ? "支持直接粘贴图片；每张不超过 5 MB，格式为 PNG、JPEG 或 WebP。图片说明可在正文中修改，地址后的双引号文字会显示为图注。" : "纯文本会按原有换行显示。"}</p>
    {uploading && <p role="status" className="mt-3 text-base text-foreground-secondary">正在上传图片，完成后即可保存。</p>}
    {notice && <p role="status" className="mt-3 text-base text-foreground-secondary">{notice}</p>}
    {error && <p role="alert" className="mt-3 text-base text-danger">{error}</p>}
    {retryFiles.length > 0 && <button type="button" disabled={disabled || uploading} onClick={() => void upload(retryFiles)} className="mt-2 min-h-11 text-base font-medium text-primary">重试上传{retryFiles.length > 1 ? `（${retryFiles.length} 张）` : ""}</button>}
  </div>;
}

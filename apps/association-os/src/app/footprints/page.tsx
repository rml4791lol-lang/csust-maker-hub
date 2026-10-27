"use client";

import { useEffect, useState } from "react";
import { Paperclip, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

interface Footprint {
  id: string;
  member: string;
  author_dept: string | null;
  date: string;
  content: string;
  project: string | null;
  hours: number;
  attachment_name: string | null;
  attachment_path: string | null;
  attachment_size: number | null;
  attachment_type: string | null;
  created_at: string;
}

function isImage(type: string | null) {
  return Boolean(type && type.startsWith("image/"));
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function FootprintsPage() {
  const [items, setItems] = useState<Footprint[] | null>(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");

  function load() {
    fetch("/api/footprints", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: unknown) => setItems(Array.isArray(d) ? (d as Footprint[]) : []))
      .catch(() => setItems([]));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-8 md:px-8">
      <PageHeader
        title="足迹"
        description="记录做了什么，可以带材料。所有人可见。"
      >
        <button
          onClick={() => {
            setNotice("");
            setOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-base font-medium text-background transition-colors hover:bg-primary-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          记一条
        </button>
      </PageHeader>

      {notice && (
        <div className="mb-4 rounded-md border border-success/30 bg-success/10 px-4 py-2 text-base text-success">
          {notice}
        </div>
      )}

      {items === null ? (
        <p className="py-16 text-center text-base text-foreground-muted">
          加载中…
        </p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-base text-foreground-muted">
            还没有足迹，点右上角「记一条」开始
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((f) => (
            <li key={f.id} className="panel overflow-hidden">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-5 py-3">
                <span className="text-lg font-semibold text-foreground">
                  {f.member}
                </span>
                {f.author_dept && (
                  <span className="text-sm text-foreground-muted">
                    {f.author_dept}
                  </span>
                )}
                <span className="num ml-auto text-sm text-foreground-muted">
                  {f.date}
                </span>
              </div>

              <div className="px-5 py-4">
                <p className="prose-cn text-base leading-relaxed text-foreground">
                  {f.content}
                </p>

                {f.attachment_path && (
                  <div className="mt-3">
                    {isImage(f.attachment_type) ? (
                      <a
                        href={`/api/uploads/${f.attachment_path}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block overflow-hidden rounded border border-border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/uploads/${f.attachment_path}`}
                          alt={f.attachment_name ?? "附件"}
                          className="max-h-72 max-w-full object-cover"
                        />
                      </a>
                    ) : (
                      <a
                        href={`/api/uploads/${f.attachment_path}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded border border-border bg-surface-3 px-3 py-2 text-sm text-foreground-secondary hover:text-foreground"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {f.attachment_name}
                        <span className="num text-foreground-muted">
                          {formatSize(f.attachment_size)}
                        </span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <UploadModal
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            setNotice("已发布");
            load();
          }}
        />
      )}
    </div>
  );
}

function UploadModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [member, setMember] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!member.trim()) {
      setError("请填一下名字");
      return;
    }
    if (!content.trim()) {
      setError("请描述一下做了什么");
      return;
    }
    setSubmitting(true);
    setError("");

    const fd = new FormData();
    fd.set("member", member.trim());
    fd.set("content", content.trim());
    if (file) fd.set("file", file);

    try {
      const res = await fetch("/api/footprints", { method: "POST", body: fd });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "提交失败");
        setSubmitting(false);
        return;
      }
      onDone();
    } catch {
      setError("网络错误，请重试");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="panel w-full max-w-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">记一条</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-foreground-muted hover:bg-surface-3 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="是谁">
            <input
              value={member}
              onChange={(e) => setMember(e.target.value)}
              placeholder="你的名字"
              maxLength={20}
              className={inputCls}
            />
          </Field>

          <Field label="做了什么">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="比如：完成了主页 hero 重构，调整了信息层级"
              className={cn(inputCls, "h-auto resize-none py-2")}
            />
            <span className="mt-1 block text-right text-sm text-foreground-muted">
              {content.length}/500
            </span>
          </Field>

          <Field label="材料（可选，图片或 PDF，≤5MB）">
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 text-base text-foreground-muted hover:border-border-strong hover:text-foreground-secondary">
              <Paperclip className="h-4 w-4" />
              {file ? file.name : "选择文件（不上传也行）"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file && (
              <button
                onClick={() => setFile(null)}
                className="mt-1 text-sm text-foreground-muted hover:text-danger"
              >
                移除文件
              </button>
            )}
          </Field>

          {error && (
            <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-2 text-base text-foreground-secondary hover:text-foreground"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-base font-medium text-background hover:bg-primary-hover disabled:opacity-60"
          >
            {submitting ? "发布中…" : "发布"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-md border border-border bg-surface-3 px-3 text-base text-foreground outline-none placeholder:text-foreground-muted focus:border-primary/50";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-foreground-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

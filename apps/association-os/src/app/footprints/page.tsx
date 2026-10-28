"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { recordHref } from "@/lib/content-modules";
import { Paperclip } from "lucide-react";
import { PageHeader } from "@/components/page-header";

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
  const [loadError, setLoadError] = useState(false);

  function load() {
    fetch("/api/footprints", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("Failed to load footprints"); return r.json(); })
      .then((d: unknown) => { setItems(Array.isArray(d) ? (d as Footprint[]) : []); setLoadError(false); })
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-8 md:px-8">
      <PageHeader title="足迹" description="每一次实践，都值得留下记录。" />

      {loadError ? <div role="alert" className="py-12 text-base"><p className="text-foreground-secondary">暂时无法加载足迹。</p><button onClick={load} className="mt-4 min-h-11 rounded-md border border-border px-4">重新加载</button></div> : items === null ? (
        <p className="py-16 text-center text-base text-foreground-muted">
          加载中…
        </p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-base text-foreground-muted">
            还没有公开足迹。
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
                <Link href={recordHref("footprints", f.id)} className="mt-3 inline-flex min-h-11 items-center text-base text-primary hover:underline">查看详情</Link>

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


    </div>
  );
}

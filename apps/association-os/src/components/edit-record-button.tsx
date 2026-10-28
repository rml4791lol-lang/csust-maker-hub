"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/components/admin-auth-provider";
import { CONTENT_MODULES, type ContentModule } from "@/lib/content-modules";
import { publishHref } from "@/lib/publishing";

export function EditRecordButton({ module, id, label }: { module: ContentModule; id?: string; label?: string }) {
  const router = useRouter();
  const { requireAdmin } = useAdminAuth();
  const [pending, setPending] = useState(false);
  const entityLabel = module === "library" ? "内容" : CONTENT_MODULES[module].label;
  return <button type="button" disabled={pending} onClick={async () => {
    if (pending) return;
    setPending(true);
    try { await requireAdmin(() => router.push(id ? publishHref(module, id) : `${publishHref(module)}/new`)); }
    finally { setPending(false); }
  }} className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-md border border-border-strong px-5 text-base font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-surface-2 disabled:cursor-wait disabled:opacity-60">
    {pending ? "正在打开…" : label ?? `${id ? "编辑" : "新增"}${entityLabel}`}
  </button>;
}

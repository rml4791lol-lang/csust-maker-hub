"use client";

import Link from "next/link";
import { useId, useLayoutEffect, useState } from "react";
import { useAdminAuth } from "@/components/admin-auth-provider";
import { PublishFootprintForm } from "@/components/publish-footprint-form";
import { CONTENT_MODULES, entityLabel, recordHref, recordTitle, valueLabel, type ContentModule } from "@/lib/content-modules";
import { isPublished, publishHref } from "@/lib/publishing";

type Row = Record<string, unknown>;
type Phase = "loading" | "login" | "ready" | "error";

export function PublishList({ module }: { module: ContentModule }) {
  return <ModuleList key={module} module={module} />;
}

function ModuleList({ module }: { module: ContentModule }) {
  const instanceId = useId();
  const { requireAdmin } = useAdminAuth();
  const meta = CONTENT_MODULES[module];
  const [phase, setPhase] = useState<Phase>("loading");
  const [records, setRecords] = useState<Row[]>([]);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useLayoutEffect(() => {
    const controller = new AbortController();
    // A preserved Next Activity must not flash its previous private list.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Gate a restored private view before paint.
    setPhase("loading");
    async function load() {
      try {
        const authResponse = await fetch("/api/auth/status", { cache: "no-store", signal: controller.signal });
        if (!authResponse.ok) throw new Error("无法检查登录状态，请重试。");
        const auth = await authResponse.json() as { authenticated: boolean };
        if (controller.signal.aborted) return;
        if (!auth.authenticated) { setRecords([]); setPhase("login"); return; }
        // No private request is made until authentication has been confirmed.
        const response = await fetch(`/api/admin/${meta.table}`, { cache: "no-store", signal: controller.signal });
        if (controller.signal.aborted) return;
        if (response.status === 401) { setRecords([]); setPhase("login"); return; }
        if (!response.ok) throw new Error("暂时无法加载内容，请重试。");
        const data: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (!Array.isArray(data)) throw new Error("内容响应格式有误，请重试。");
        setRecords(data as Row[]); setPhase("ready"); setError("");
      } catch (cause) {
        if (!controller.signal.aborted) { setRecords([]); setError(cause instanceof Error ? cause.message : "网络暂时不可用，请重试。"); setPhase("error"); }
      }
    }
    void load();
    return () => controller.abort();
  }, [meta.table, revision]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("退出登录失败，请重试。");
      setRecords([]); setNotice(""); setPhase("login");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "网络暂时不可用，请重试。"); }
    finally { setLoggingOut(false); }
  }

  const hasDrafts = module === "library" || module === "footprints";
  const query = search.trim().toLocaleLowerCase();
  const shown = records.filter((record) => {
    const visible = isPublished(module, record.status);
    if (filter === "public" && !visible || filter === "private" && visible) return false;
    if (!query) return true;
    return [record[meta.titleKey], record.summary, record.content, record.author, record.owner, record.member].some((value) => typeof value === "string" && value.toLocaleLowerCase().includes(query));
  });

  return <div className="mx-auto w-full max-w-[1180px] px-4 py-8 md:px-8 md:py-10">
    <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
      <div><h1 className="text-[32px] font-semibold leading-tight tracking-tight">{module === "library" ? "社区文章" : `${meta.label}管理`}</h1>
        <p className="mt-3 text-base leading-relaxed text-foreground-secondary">{hasDrafts ? "在这里新增内容、继续编辑，并管理公开状态。" : "在这里录入和维护官网内容。保存后会更新公开页面。"}</p>
      </div>
      {phase === "ready" && <div className="flex flex-wrap gap-3">
        {module === "footprints" && <PublishFootprintForm onSaved={() => { setNotice("足迹与材料已公开，可以继续编辑或查看公开页。"); setRevision((value) => value + 1); }} />}
        <Link href={`${publishHref(module)}/new`} className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-5 text-base font-semibold text-background">{module === "library" ? "写文章" : `新增${entityLabel(module)}`}</Link>
      </div>}
    </header>
    {notice && <p role="status" className="mb-6 border-l-2 border-primary py-2 pl-4 text-base leading-relaxed">{notice}</p>}
    {phase === "loading" && <p role="status" className="py-12 text-base text-foreground-secondary">正在加载…</p>}
    {phase === "login" && <section className="max-w-[760px] border-y border-border py-8">
      <h2 className="text-xl font-semibold">登录后管理内容</h2>
      <p className="mt-3 text-base leading-relaxed text-foreground-secondary">官网内容可直接浏览。管理员登录后，才能查看草稿、录入和修改内容。</p>
      <button type="button" onClick={() => void requireAdmin(() => setRevision((value) => value + 1))} className="mt-6 min-h-12 rounded-md bg-foreground px-6 text-base font-semibold text-background">登录并继续</button>
    </section>}
    {error && <div role="alert" className="mb-6 text-base leading-relaxed text-danger"><p>{error}</p>{phase === "error" && <button type="button" onClick={() => setRevision((value) => value + 1)} className="mt-3 min-h-12 rounded-md border border-border-strong px-5 text-foreground">重新加载</button>}</div>}
    {phase === "ready" && <>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label htmlFor={`${instanceId}-search`} className="min-w-0 flex-1 text-base font-medium">搜索{entityLabel(module)}<input id={`${instanceId}-search`} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="输入标题、作者或摘要" className="mt-2 block h-12 w-full min-w-0 rounded-md border border-border-strong bg-surface-1 px-4 text-base font-normal outline-none placeholder:text-foreground-muted focus:border-primary" /></label>
        {hasDrafts && <label htmlFor={`${instanceId}-visibility`} className="min-w-[140px] text-base font-medium">公开状态<select id={`${instanceId}-visibility`} value={filter} onChange={(event) => setFilter(event.target.value)} className="mt-2 block h-12 w-full rounded-md border border-border-strong bg-surface-1 px-4 text-base font-normal outline-none focus:border-primary"><option value="all">全部</option><option value="private">未公开</option><option value="public">已公开</option></select></label>}
      </div>
      <p role="status" className="mb-4 text-sm text-foreground-secondary">显示 {shown.length} 条，共 {records.length} 条</p>
      {shown.length === 0 ? <div className="border-y border-border py-12"><p className="text-lg font-medium">{records.length === 0 ? `还没有${entityLabel(module)}` : "没有匹配的内容"}</p><p className="mt-3 text-base text-foreground-secondary">{records.length === 0 ? "从右上方的新增入口开始。" : "尝试其他关键词，或调整公开状态。"}</p></div> : <ul className="divide-y divide-border border-y border-border">
        {shown.map((record) => {
          const id = String(record.id ?? "");
          const title = recordTitle(module, record);
          const published = isPublished(module, record.status);
          const description = String(record.summary || record.content || record.description || "");
          const metadata = [module === "library" ? record.author : module === "projects" ? record.owner : module === "members" ? record.dept : "", record.updated || record.date || record.deadline, record.status ? valueLabel(record.status) : ""].filter(Boolean).map(String);
          return <li key={id} className="flex min-w-0 flex-col gap-4 py-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
            <div className="min-w-0 flex-1"><Link href={publishHref(module, id)} className="text-xl font-medium leading-relaxed text-foreground hover:text-primary break-words">{title}</Link>
              {description && <p className="mt-2 line-clamp-2 text-base leading-relaxed text-foreground-secondary break-words">{description}</p>}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground-secondary"><span>{published ? "已公开" : "未公开"}</span>{metadata.map((value, index) => <span key={`${index}-${value}`}>{value}</span>)}</div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1">
              <Link href={publishHref(module, id)} aria-label={`编辑${title}`} className="inline-flex min-h-11 items-center text-base font-medium text-primary">编辑</Link>
              {published && <Link href={recordHref(module, id)} aria-label={`查看${title}公开页`} className="inline-flex min-h-11 items-center text-base text-foreground-secondary hover:text-foreground">查看公开页</Link>}
            </div>
          </li>;
        })}
      </ul>}
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3"><Link href={`/${module}`} className="inline-flex min-h-11 items-center text-base text-foreground-secondary hover:text-foreground">查看公开{module === "library" ? "社区" : meta.label}</Link><button type="button" disabled={loggingOut} onClick={() => void logout()} className="min-h-11 text-base text-foreground-secondary hover:text-foreground disabled:opacity-60">{loggingOut ? "正在退出…" : "退出登录"}</button></footer>
    </>}
  </div>;
}

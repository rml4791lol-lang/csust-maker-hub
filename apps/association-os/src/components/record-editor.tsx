"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/components/admin-auth-provider";
import { MarkdownEditor } from "@/components/markdown-editor";
import { TABLE_DEFS, validateFields, type FieldDef } from "@/lib/admin-schema";
import { CONTENT_MODULES, recordHref, valueLabel, type ContentModule } from "@/lib/content-modules";
import { isPublished, publishHref } from "@/lib/publishing";
import { FLOWS } from "@/lib/workflow";

type Values = Record<string, string>;
type RecordData = Record<string, unknown>;
type FieldGroup = { title: string; keys: string[] };
const GROUPS: Record<ContentModule, FieldGroup[]> = {
  projects: [{ title: "项目信息", keys: ["name", "owner"] }, { title: "项目说明", keys: ["description"] }, { title: "进展", keys: ["status", "updated"] }],
  library: [{ title: "内容信息", keys: ["title", "author", "type", "topic", "tags"] }, { title: "内容与来源", keys: ["summary", "body", "source_url"] }, { title: "发布", keys: ["status", "updated"] }],
  members: [{ title: "成员信息", keys: ["name", "dept", "role", "grade"] }, { title: "技能与方向", keys: ["skills"] }],
  competitions: [{ title: "赛事信息", keys: ["name", "host", "level"] }, { title: "参赛安排", keys: ["status", "deadline", "teams", "members"] }],
  activities: [{ title: "活动信息", keys: ["title", "kind", "date", "place"] }, { title: "参与登记", keys: ["status", "joined", "capacity"] }],
  achievements: [{ title: "成果信息", keys: ["title", "level", "competition", "date"] }, { title: "成员与证明", keys: ["members", "has_certificate"] }],
  footprints: [{ title: "完成记录", keys: ["member", "content"] }, { title: "关联与进度", keys: ["project", "hours", "date", "status"] }],
};
const DEFAULT_STATUS: Record<string, string> = { projects: "立项", items: "草稿", contributions: "draft" };
const CONTROL = "mt-2 h-12 w-full rounded-md border border-border-strong bg-surface-1 px-4 text-base text-foreground outline-none placeholder:text-foreground-muted focus:border-primary disabled:cursor-wait disabled:opacity-60";

function fieldValues(fields: FieldDef[], data: RecordData = {}, table = "") {
  return Object.fromEntries(fields.map((field) => {
    const value = data[field.key] ?? (field.key === "status" ? DEFAULT_STATUS[table] : undefined) ?? (field.type === "number" ? 0 : "");
    return [field.key, Array.isArray(value) ? value.join("，") : String(value)];
  }));
}

export function RecordEditor({ module, id }: { module: ContentModule; id?: string }) {
  return <EditorForm key={`${module}:${id ?? "new"}`} module={module} id={id} />;
}

function EditorForm({ module, id }: { module: ContentModule; id?: string }) {
  const instanceId = useId();
  const errorId = `${instanceId}-error`;
  const noticeId = `${instanceId}-notice`;
  const dialogTitleId = `${instanceId}-leave-title`;
  const router = useRouter();
  const { requireAdmin } = useAdminAuth();
  const meta = CONTENT_MODULES[module];
  const entityLabel = module === "library" ? "内容" : meta.label;
  const def = TABLE_DEFS[meta.table];
  const [phase, setPhase] = useState<"loading" | "login" | "ready" | "missing" | "error">("loading");
  const [revision, setRevision] = useState(0);
  const [values, setValues] = useState<Values>({});
  const [baseline, setBaseline] = useState<Values>({});
  const [original, setOriginal] = useState<RecordData | null>(null);
  const [recordId, setRecordId] = useState(id);
  const [departments, setDepartments] = useState<string[]>([]);
  const [departmentsError, setDepartmentsError] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const savingRef = useRef(false);
  const uploadingRef = useRef(false);
  const leaveDialog = useRef<HTMLDialogElement>(null);
  const leaveTarget = useRef(publishHref(module));
  const allowNavigation = useRef(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [errorField, setErrorField] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const historyGuard = useRef(false);
  const historyGuardHref = useRef("");
  const leavingHistory = useRef(false);
  const leaveAction = useRef<"route" | "history">("route");
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);
  const busy = saving || uploading;
  const title = `${recordId ? "编辑" : "新增"}${entityLabel}`;
  const backHref = publishHref(module);
  const changeUploading = useCallback((value: boolean) => { uploadingRef.current = value; setUploading(value); }, []);

  useEffect(() => {
    // Activity restores refs when a cached editor becomes visible again. Only
    // bypass navigation during the current exit, never during the next visit.
    allowNavigation.current = false;
    leavingHistory.current = false;
    leaveAction.current = "route";
    historyGuard.current = window.history.state?.associationEditorGuard === instanceId;
    historyGuardHref.current = historyGuard.current ? window.location.href : "";
    return () => {
      allowNavigation.current = true;
      leavingHistory.current = false;
      historyGuard.current = false;
      historyGuardHref.current = "";
    };
  }, [instanceId]);

  useLayoutEffect(() => {
    const controller = new AbortController();
    // Activity can reveal a cached ready form before its fresh GET resolves.
    // Hide those controls before paint so renewed data cannot overwrite typing.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This reset must precede the first visible frame after Activity restoration.
    setPhase("loading");
    async function load() {
      try {
        const statusResponse = await fetch("/api/auth/status", { cache: "no-store", signal: controller.signal });
        if (!statusResponse.ok) throw new Error("无法检查登录状态，请重试");
        const status = await statusResponse.json() as { authenticated: boolean };
        if (controller.signal.aborted) return;
        if (!status.authenticated) { setPhase("login"); return; }
        let record: RecordData = {};
        if (id) {
          const response = await fetch(`/api/admin/${meta.table}/${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal });
          if (controller.signal.aborted) return;
          if (response.status === 401) { setPhase("login"); return; }
          if (response.status === 404) { setPhase("missing"); return; }
          if (!response.ok) throw new Error("内容加载失败，请重试");
          record = await response.json() as RecordData;
        }
        if (controller.signal.aborted) return;
        const next = fieldValues(def.fields, record, meta.table);
        if (module === "library") next.body_format = id ? String(record.body_format || "plain") : "markdown";
        setRecordId(id); setValues(next); setBaseline(next); setOriginal(id ? record : null); setPhase("ready"); setError(""); setNotice("");
        if (def.fields.some((field) => field.key === "dept")) {
          try {
            const response = await fetch("/api/departments", { cache: "no-store", signal: controller.signal });
            if (!response.ok) throw new Error("Departments unavailable");
            const records = await response.json() as Array<{ name: string }>;
            if (controller.signal.aborted) return;
            if (!Array.isArray(records)) throw new Error("Departments unavailable");
            setDepartments(records.map((entry) => entry.name).filter((name) => typeof name === "string" && name.length > 0));
            setDepartmentsError(false);
          } catch { if (!controller.signal.aborted) setDepartmentsError(true); }
        }
      } catch (cause) {
        if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : "加载失败，请重试"); setPhase("error"); }
      }
    }
    void load();
    return () => controller.abort();
  }, [id, module, meta.table, def, revision]);

  useEffect(() => {
    if (!dirty && !uploading) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      if (allowNavigation.current) return;
      event.preventDefault(); event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, uploading]);

  useEffect(() => {
    if (!dirty && !uploading) return;
    function interceptLink(event: MouseEvent) {
      if (allowNavigation.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target && anchor.target !== "_self" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault(); event.stopPropagation();
      if (savingRef.current || uploadingRef.current) return;
      leaveAction.current = "route"; leaveTarget.current = `${url.pathname}${url.search}${url.hash}`; setConfirmLeave(true);
    }
    document.addEventListener("click", interceptLink, true);
    return () => document.removeEventListener("click", interceptLink, true);
  }, [dirty, uploading]);

  useEffect(() => {
    if ((dirty || uploading) && !historyGuard.current) {
      historyGuardHref.current = window.location.href;
      window.history.pushState({ ...window.history.state, associationEditorGuard: instanceId }, "", window.location.href);
      historyGuard.current = true;
    }
  }, [dirty, uploading, instanceId]);

  useEffect(() => {
    function back(event: PopStateEvent) {
      if (allowNavigation.current || !historyGuard.current || leavingHistory.current || window.history.state?.associationEditorGuard === instanceId) return;
      event.stopImmediatePropagation();
      if (dirty || savingRef.current || uploadingRef.current) {
        window.history.pushState({ ...window.history.state, associationEditorGuard: instanceId }, "", historyGuardHref.current);
        if (!savingRef.current && !uploadingRef.current) { leaveAction.current = "history"; setConfirmLeave(true); }
      } else {
        leavingHistory.current = true; historyGuard.current = false; window.history.back();
      }
    }
    window.addEventListener("popstate", back, true);
    return () => window.removeEventListener("popstate", back, true);
  }, [dirty, instanceId]);

  useEffect(() => {
    if (!error) return;
    errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    const dialog = leaveDialog.current;
    if (confirmLeave) leaveDialog.current?.showModal();
    else leaveDialog.current?.close();
    // Next Activity cleans up effects when a preserved route becomes hidden.
    // Closing the native top-layer dialog prevents it blocking the active page.
    return () => dialog?.close();
  }, [confirmLeave]);

  function leave(href: string) {
    if (savingRef.current || uploadingRef.current) return;
    if (dirty) { leaveAction.current = "route"; leaveTarget.current = href; setConfirmLeave(true); return; }
    allowNavigation.current = true;
    if (historyGuard.current) { historyGuard.current = false; router.replace(href); }
    else router.push(href);
  }

  function options(field: FieldDef) {
    if (field.key === "dept") return Array.from(new Set([...departments, ...(values.dept ? [values.dept] : [])]));
    const flow = FLOWS[meta.table];
    if (flow?.field === field.key) {
      const current = original ? String(original[field.key] ?? "") : DEFAULT_STATUS[meta.table];
      return current ? [current, ...(original ? flow.flow[current] ?? [] : [])] : [];
    }
    return field.options ?? [];
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || uploadingRef.current || !event.currentTarget.reportValidity()) return;
    const payload = Object.fromEntries(def.fields.map((field) => {
      const text = values[field.key] ?? "";
      return [field.key, field.type === "number" ? Number(text) : field.type === "tags" ? text.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) : text.trim()];
    }));
    const invalid = validateFields(payload, def);
    if (invalid) { setErrorField(def.fields.find((field) => invalid.startsWith(field.label))?.key ?? null); setError(invalid); return; }
    if (module === "activities" && Number(payload.joined) > Number(payload.capacity)) { setErrorField("joined"); setError("已报名人数不能超过名额"); return; }
    savingRef.current = true; setSaving(true); setError(""); setErrorField(null); setNotice("");
    try {
      const response = await fetch(`/api/admin/${meta.table}${recordId ? `/${encodeURIComponent(recordId)}` : ""}`, {
        method: recordId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        setError("登录已失效，当前输入已保留。重新登录后请再次点击保存。");
        void requireAdmin(() => setNotice("已重新登录。请检查内容，再次点击保存。"));
        return;
      }
      const result = await response.json() as RecordData & { error?: string; record?: RecordData };
      if (!response.ok) {
        const message = result.error || (response.status === 404 ? "这条内容已不存在，当前输入已保留" : "保存失败，请重试");
        setErrorField(def.fields.find((field) => message.startsWith(field.label))?.key ?? null);
        throw new Error(message);
      }
      const saved = result.record && typeof result.record === "object" ? result.record : result;
      const savedId = String(saved[def.stableKey ?? def.pk] ?? result.id ?? recordId ?? "");
      if (!savedId) throw new Error("内容已提交，但未取得记录标识。请先到管理后台核对，不要重复提交。");
      const next = fieldValues(def.fields, saved, meta.table);
      setRecordId(savedId); setOriginal(saved); setValues(next); setBaseline(next);
      setNotice(isPublished(module, saved.status)
        ? "已保存，公开页面已更新。可以继续编辑，或查看公开页。"
        : `已保存为${valueLabel(saved.status) || "未公开内容"}，尚未公开。可以继续编辑，或返回列表。`);
      // Keep the mounted form and its success state in the publishing center.
      window.history.replaceState(window.history.state, "", publishHref(module, savedId));
      historyGuardHref.current = window.location.href;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "网络暂时不可用，当前输入已保留，请重试"); }
    finally { savingRef.current = false; setSaving(false); }
  }

  return <div className="mx-auto w-full max-w-[1180px] px-4 py-8 md:px-8 md:py-10">
    <nav aria-label="当前位置" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-foreground-secondary">
      <button type="button" disabled={busy} onClick={() => leave(backHref)} className="min-h-11 hover:text-foreground">{module === "library" ? "社区文章" : meta.label}</button>
      <span aria-hidden="true">/</span><span aria-current="page">{title}</span>
    </nav>
    <header className="mb-9 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
      <h1 className="text-[32px] font-semibold leading-tight tracking-tight">{title}</h1>
      <button type="button" disabled={busy} onClick={() => leave(backHref)} className="min-h-11 text-base text-foreground-secondary hover:text-foreground">返回发布列表</button>
    </header>
    {phase === "loading" && <p role="status" className="py-12 text-base text-foreground-secondary">正在加载…</p>}
    {phase === "login" && <section className="max-w-[760px] border-b border-border py-8">
      <h2 className="text-xl font-semibold">登录后{recordId ? "编辑" : "新增"}{entityLabel}</h2>
      <p className="mt-3 text-base leading-relaxed text-foreground-secondary">浏览无需登录。使用管理员账号继续修改内容。</p>
      <button type="button" onClick={() => void requireAdmin(() => { setPhase("loading"); setRevision((value) => value + 1); })} className="mt-6 min-h-12 rounded-md bg-foreground px-6 text-base font-semibold text-background">登录并继续</button>
    </section>}
    {phase === "missing" && <section className="py-12"><h2 className="text-xl font-semibold">找不到这条{entityLabel}</h2><p className="mt-3 text-base text-foreground-secondary">它可能已被删除，返回列表查看其他内容。</p></section>}
    {phase === "error" && <section className="py-12"><p ref={errorRef} id={errorId} role="alert" tabIndex={-1} className="text-base text-danger outline-none">{error}</p><button type="button" onClick={() => { setPhase("loading"); setRevision((value) => value + 1); }} className="mt-4 min-h-12 rounded-md border border-border-strong px-5 text-base">重新加载</button></section>}
    {phase === "ready" && <form onSubmit={save} className="max-w-[760px]">
      {notice && <p id={noticeId} role="status" className="mb-6 border-l-2 border-primary py-2 pl-4 text-base leading-relaxed text-foreground">{notice}</p>}
      {GROUPS[module].map((group) => <fieldset key={group.title} disabled={saving} className="mb-9 border-b border-border pb-8">
        <legend className="mb-6 text-xl font-semibold">{group.title}</legend>
        <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2">
          {group.keys.map((key) => {
            const field = def.fields.find((candidate) => candidate.key === key);
            if (!field) return null;
            const full = [meta.titleKey, "tags", "skills", "members", "source_url"].includes(key) || field.type === "textarea";
            const controlId = `${instanceId}-${key}`;
            const redundantLabel = group.keys.length === 1 && group.title === field.label;
            const hintId = `${controlId}-hint`;
            const hasHint = field.type === "tags" || key === "dept" || key === "status" && !recordId && Boolean(FLOWS[meta.table]);
            const describedBy = [hasHint ? hintId : "", error && errorField === key ? errorId : ""].filter(Boolean).join(" ") || undefined;
            const change = (value: string) => { setValues((current) => ({ ...current, [key]: value })); setNotice(""); if (errorField === key) { setError(""); setErrorField(null); } };
            return <div key={key} className={full ? "sm:col-span-2" : ""}>
              <label htmlFor={controlId} className={redundantLabel ? "sr-only" : "text-base font-medium"}>{field.label}{field.required && <span className="ml-1 text-foreground-secondary">（必填）</span>}</label>
              {module === "library" && key === "body" ? <MarkdownEditor id={controlId} value={values.body ?? ""} format={values.body_format || "plain"} onChange={change}
                onFormatChange={(format) => { setValues((current) => ({ ...current, body_format: format })); setNotice(""); }}
                onUploadingChange={changeUploading} disabled={saving} maxLength={field.maxLength} describedBy={describedBy} invalid={errorField === key} />
                : key === "has_certificate" ? <select id={controlId} name={key} data-field={key} value={values[key] ?? "0"} onChange={(event) => change(event.target.value)} className={CONTROL} aria-describedby={describedBy} aria-invalid={errorField === key || undefined}><option value="0">无</option><option value="1">有</option></select>
                : field.type === "textarea" ? <textarea id={controlId} name={key} data-field={key} required={field.required} maxLength={field.maxLength ?? 200} rows={key === "body" ? 12 : key === "description" ? 7 : 4} value={values[key] ?? ""} onChange={(event) => change(event.target.value)} placeholder={field.placeholder} aria-describedby={describedBy} aria-invalid={errorField === key || undefined} className={`${CONTROL} h-auto resize-y py-3 leading-relaxed`} />
                : field.type === "select" ? <select id={controlId} name={key} data-field={key} required={field.required} value={values[key] ?? ""} onChange={(event) => change(event.target.value)} aria-describedby={describedBy} aria-invalid={errorField === key || undefined} className={CONTROL}>
                  {key !== "status" || !FLOWS[meta.table] ? <option value="">请选择</option> : null}
                  {options(field).map((option) => <option key={option} value={option}>{valueLabel(option)}</option>)}
                </select>
                  : <input id={controlId} name={key} data-field={key} type={field.type === "number" ? "number" : field.type === "url" ? "url" : field.type === "date" ? "date" : "text"} required={field.required} maxLength={field.type === "tags" ? 10099 : field.maxLength ?? 200} min={field.type === "number" ? field.min ?? 0 : undefined} max={field.type === "number" ? field.max ?? 1000000 : undefined} step={field.type === "number" ? field.step ?? 1 : undefined} value={values[key] ?? ""} onChange={(event) => change(event.target.value)} placeholder={field.placeholder} aria-describedby={describedBy} aria-invalid={errorField === key || undefined} className={CONTROL} />}
              {field.type === "tags" && <p id={hintId} className="mt-2 text-sm leading-relaxed text-foreground-secondary">多个条目用中文或英文逗号分隔。</p>}
              {key === "status" && !recordId && FLOWS[meta.table] && <p id={hintId} className="mt-2 text-sm leading-relaxed text-foreground-secondary">首次保存后，可按流程更新状态。</p>}
              {module === "library" && key === "status" && <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">草稿、待审核仅管理员可见；已发布、已收录、报名中、已归档会公开展示。</p>}
              {module === "activities" && key === "date" && <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">使用完整日期，例如 2026-10-29 19:00，活动才能出现在周排程中。</p>}
              {key === "dept" && <p id={hintId} role={departmentsError ? "status" : undefined} className={`mt-2 text-sm leading-relaxed ${departmentsError ? "text-danger" : "text-foreground-secondary"}`}>{departmentsError ? "部门暂时加载失败，现有选择仍保留。请稍后重新打开页面。" : departments.length === 0 ? "正在读取可选部门。" : "选择成员所属部门。"}</p>}
            </div>;
          })}
        </div>
      </fieldset>)}
      {error && <p ref={errorRef} id={errorId} role="alert" tabIndex={-1} className="mb-5 text-base leading-relaxed text-danger outline-none">{error}</p>}
      <div className="flex flex-wrap items-center gap-3 pb-8">
        <button type="submit" disabled={busy} className="min-h-12 rounded-md bg-foreground px-6 text-base font-semibold text-background disabled:cursor-wait disabled:opacity-60">{saving ? "正在保存…" : uploading ? "图片上传中…" : module === "library" ? isPublished(module, values.status) ? "保存并公开" : values.status === "待审核" ? "保存为待审核" : "保存草稿" : recordId ? "保存修改" : `创建${entityLabel}`}</button>
        <button type="button" disabled={busy} onClick={() => leave(backHref)} className="min-h-12 rounded-md border border-border-strong px-6 text-base text-foreground-secondary hover:text-foreground">{notice && !dirty ? "返回列表" : "取消"}</button>
        {recordId && original && isPublished(module, original.status) && <button type="button" disabled={busy} onClick={() => leave(recordHref(module, recordId))} className="min-h-12 px-4 text-base font-medium text-primary">查看公开页</button>}
        {dirty && <span className="text-sm text-foreground-secondary">有未保存的修改</span>}
      </div>
    </form>}
    <dialog ref={leaveDialog} id={`${instanceId}-leave-dialog`} aria-labelledby={dialogTitleId} onCancel={(event) => { event.preventDefault(); setConfirmLeave(false); }} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border-strong bg-surface-1 p-6 text-foreground backdrop:bg-black/70">
      <h2 id={dialogTitleId} className="text-xl font-semibold">放弃未保存的修改？</h2>
      <p className="mt-3 text-base leading-relaxed text-foreground-secondary">离开后，这次修改不会保留。</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => setConfirmLeave(false)} className="min-h-12 rounded-md bg-foreground px-5 text-base font-semibold text-background">继续编辑</button>
        <button type="button" onClick={() => {
          allowNavigation.current = true; setConfirmLeave(false);
          if (leaveAction.current === "history") { leavingHistory.current = true; historyGuard.current = false; window.history.go(-2); }
          else if (historyGuard.current) { historyGuard.current = false; router.replace(leaveTarget.current); }
          else router.push(leaveTarget.current);
        }} className="min-h-12 rounded-md border border-border-strong px-5 text-base text-foreground-secondary">放弃并离开</button>
      </div>
    </dialog>
  </div>;
}

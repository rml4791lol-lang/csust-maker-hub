"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useAdminAuth } from "@/components/admin-auth-provider";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);
const CONTROL = "mt-2 block w-full rounded-md border border-border-strong bg-background px-4 py-3 text-base font-normal outline-none focus:border-primary";

export function PublishFootprintForm({ onSaved }: { onSaved: () => void }) {
  const id = useId();
  const { requireAdmin } = useAdminAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [member, setMember] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const dirty = Boolean(member || content || file);

  useEffect(() => {
    const element = dialog.current;
    if (open) element?.showModal();
    else element?.close();
    return () => element?.close();
  }, [open]);
  useEffect(() => {
    if (!open || !dirty) return;
    function protect(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ""; }
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [open, dirty]);

  function close() {
    if (pendingRef.current) return;
    if (dirty) { setConfirmClose(true); return; }
    setOpen(false);
  }
  function discard() {
    setMember(""); setContent(""); setFile(null); setError(""); setNotice(""); setConfirmClose(false); setOpen(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current || !event.currentTarget.reportValidity()) return;
    if (!member.trim() || !content.trim()) { setError("请填写成员姓名和完成记录。"); return; }
    if (file && (!ALLOWED_TYPES.has(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024)) { setError("材料应为 PNG、JPEG、WebP、GIF 或 PDF，且不超过 5 MB。"); return; }
    const data = new FormData();
    data.set("member", member.trim()); data.set("content", content.trim());
    if (file) data.set("file", file);
    pendingRef.current = true; setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/footprints", { method: "POST", body: data });
      if (response.status === 401) {
        setError("登录已失效，输入和材料已保留。重新登录后请再次点击发布。");
        void requireAdmin(() => setNotice("已重新登录，请检查内容后再次点击发布。"));
        return;
      }
      const result = await response.json() as { error?: string; id?: string };
      if (!response.ok) throw new Error(result.error || "发布失败，请重试。");
      discard(); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "网络暂时不可用，输入和材料已保留。"); }
    finally { pendingRef.current = false; setPending(false); }
  }

  return <>
    <button type="button" onClick={() => { setConfirmClose(false); setOpen(true); }} className="min-h-12 rounded-md border border-border-strong px-5 text-base font-medium">记录并上传材料</button>
    <dialog ref={dialog} aria-labelledby={`${id}-title`} onCancel={(event) => { event.preventDefault(); close(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-lg border border-border-strong bg-surface-1 p-6 text-foreground backdrop:bg-black/70 md:p-8">
      {open && <>
        <div className="flex items-start justify-between gap-4"><h2 id={`${id}-title`} className="text-2xl font-semibold">发布足迹与材料</h2><button type="button" disabled={pending} onClick={close} className="min-h-11 text-base text-foreground-secondary">关闭</button></div>
        <p className="mt-3 text-base leading-relaxed text-foreground-secondary">提交后，足迹和所选材料会立即公开。如需保存草稿，请使用“新增足迹”。</p>
        <form onSubmit={submit} className="mt-6 space-y-5">
          <fieldset disabled={pending} className="space-y-5">
            <label htmlFor={`${id}-member`} className="block text-base font-medium">成员姓名（必填）<input id={`${id}-member`} name="member" value={member} onChange={(event) => setMember(event.target.value)} required maxLength={20} className={CONTROL} /></label>
            <label htmlFor={`${id}-content`} className="block text-base font-medium">完成记录（必填）<textarea id={`${id}-content`} name="content" value={content} onChange={(event) => setContent(event.target.value)} required maxLength={500} rows={5} className={`${CONTROL} resize-y leading-relaxed`} /></label>
            <label htmlFor={`${id}-file`} className="block text-base font-medium">证明材料（选填）<input id={`${id}-file`} name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(""); }} className="mt-2 block min-h-12 w-full max-w-full text-sm text-foreground-secondary file:mr-3 file:min-h-11 file:rounded file:border file:border-border-strong file:bg-surface-2 file:px-4 file:text-base file:text-foreground" /></label>
            <p className="text-sm leading-relaxed text-foreground-secondary">支持 PNG、JPEG、WebP、GIF 或 PDF，文件不超过 5 MB。</p>
          </fieldset>
          {error && <p role="alert" className="text-base leading-relaxed text-danger">{error}</p>}
          {notice && <p role="status" className="text-base leading-relaxed text-foreground-secondary">{notice}</p>}
          {confirmClose ? <div className="border-t border-border pt-5"><p className="text-base">关闭后会放弃尚未发布的记录和材料。</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => setConfirmClose(false)} className="min-h-12 rounded-md bg-foreground px-5 text-base font-semibold text-background">继续编辑</button><button type="button" onClick={discard} className="min-h-12 px-4 text-base text-foreground-secondary">放弃并关闭</button></div></div> : <div className="flex flex-wrap gap-3"><button type="submit" disabled={pending} className="min-h-12 rounded-md bg-foreground px-5 text-base font-semibold text-background disabled:opacity-60">{pending ? "正在发布…" : "发布足迹与材料"}</button><button type="button" disabled={pending} onClick={close} className="min-h-12 px-4 text-base text-foreground-secondary">取消</button></div>}
        </form>
      </>}
    </dialog>
  </>;
}

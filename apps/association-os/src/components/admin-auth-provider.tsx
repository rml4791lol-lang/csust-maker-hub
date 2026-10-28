"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Eye, EyeOff, X } from "lucide-react";

type AuthStatus = { authenticated: boolean; configured: boolean; setupAvailable: boolean };
type AuthContext = { requireAdmin: (afterLogin?: () => void) => Promise<boolean>; reauthenticate: () => void };
const Context = createContext<AuthContext | null>(null);

export function useAdminAuth() {
  const context = useContext(Context);
  if (!context) throw new Error("AdminAuthProvider is missing");
  return context;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const callback = useRef<(() => void) | undefined>(undefined);
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useCallback(() => { setOpen(false); callback.current = undefined; }, []);
  const reauthenticate = useCallback(() => { callback.current = undefined; setStatus(null); setOpen(true); }, []);
  const requireAdmin = useCallback(async (afterLogin?: () => void) => {
    try {
      const response = await fetch("/api/auth/status", { cache: "no-store" });
      if (!response.ok) throw new Error("Unavailable");
      const next = await response.json() as AuthStatus;
      if (next.authenticated) { afterLogin?.(); return true; }
      setStatus(next);
    } catch { setStatus(null); }
    callback.current = afterLogin;
    setOpen(true);
    return false;
  }, []);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    window.addEventListener("association:reauthenticate", reauthenticate);
    return () => window.removeEventListener("association:reauthenticate", reauthenticate);
  }, [reauthenticate]);
  return <Context.Provider value={{ requireAdmin, reauthenticate }}>
    {children}
    <dialog ref={dialog} aria-labelledby="admin-login-title" onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-border-strong bg-surface-1 p-6 text-foreground shadow-2xl backdrop:bg-black/70 md:p-8">
      {open && <AdminLoginForm initialStatus={status} onCancel={close} onSuccess={() => {
        const afterLogin = callback.current;
        close();
        afterLogin?.();
      }} />}
    </dialog>
  </Context.Provider>;
}

export function AdminLoginForm({ initialStatus = null, onSuccess, onCancel }: { initialStatus?: AuthStatus | null; onSuccess: () => void; onCancel?: () => void }) {
  const [status, setStatus] = useState<AuthStatus | null>(initialStatus);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      fetch("/api/auth/status", { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error("Unavailable");
        return response.json() as Promise<AuthStatus>;
      }).then((next) => { if (!cancelled) setStatus(next); }).catch(() => { if (!cancelled) setError("暂时无法连接，请稍后重试"); });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { cancelled = true; window.removeEventListener("focus", refresh); };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: values.get("username"), password: values.get("password") }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setError(result.error || "登录失败，请重试"); return; }
      form.reset(); onSuccess();
    } catch { setError("暂时无法连接，请稍后重试"); }
    finally { setPending(false); }
  }
  return <>
    <div className="flex items-start justify-between gap-4">
      <h1 id="admin-login-title" className="text-2xl font-semibold tracking-tight">登录后编辑</h1>
      {onCancel && <button onClick={onCancel} aria-label="关闭登录" className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-md text-foreground-secondary hover:bg-surface-2"><X className="size-5" /></button>}
    </div>
    <p className="mt-3 text-base leading-relaxed text-foreground-secondary">浏览无需登录。使用管理员账号录入和修改内容。</p>
    {status && !status.configured && <div className="mt-5 rounded-md border border-border bg-surface-2 p-4 text-base leading-relaxed">
      <p>还没有管理员账号。</p>
      {status.setupAvailable
        ? <a href="http://127.0.0.1:3190/" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4">创建本机管理员账号</a>
        : <p className="mt-2 text-foreground-secondary">请联系平台负责人配置账号，仍可继续浏览。</p>}
    </div>}
    <form onSubmit={submit} className="mt-6 space-y-5">
      <label className="block text-base font-medium">账号<input name="username" autoComplete="username" required maxLength={256} autoCapitalize="none" spellCheck={false} className="mt-2 h-12 w-full rounded-md border border-border-strong bg-background px-4 text-base outline-none focus:border-accent" /></label>
      <label className="block text-base font-medium">密码<span className="relative mt-2 block"><input name="password" type={visible ? "text" : "password"} autoComplete="current-password" required maxLength={1024} className="h-12 w-full rounded-md border border-border-strong bg-background pl-4 pr-14 text-base outline-none focus:border-accent" /><button type="button" aria-label={visible ? "隐藏密码" : "显示密码"} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute right-1 top-0.5 flex size-11 items-center justify-center text-foreground-secondary">{visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button></span></label>
      {error && <p role="alert" className="text-base leading-relaxed text-danger">{error}</p>}
      <button disabled={pending || status?.configured === false} className="min-h-12 w-full rounded-md bg-foreground px-5 text-base font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50">{pending ? "正在登录…" : "登录"}</button>
      {onCancel ? <button type="button" onClick={onCancel} className="min-h-11 w-full text-base text-foreground-secondary hover:text-foreground">继续浏览</button> : <Link href="/" className="flex min-h-11 items-center justify-center text-base text-foreground-secondary">返回首页</Link>}
    </form>
  </>;
}

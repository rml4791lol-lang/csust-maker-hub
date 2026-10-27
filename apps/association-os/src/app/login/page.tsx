"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { GeometryMark } from "@/components/geometry-mark";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(""); setPending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: data.get("username"), password: data.get("password") }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setError(result.error ?? "登录失败，请重试"); return; }
      form.reset();
      window.location.replace("/admin");
    } catch { setError("暂时无法连接，请稍后重试"); }
    finally { setPending(false); }
  }

  return (
    <div className="relative isolate mx-auto flex min-h-full w-full max-w-[1240px] flex-col justify-center overflow-hidden px-6 py-12 md:px-12">
      <div aria-hidden="true" className="pointer-events-none absolute right-[-180px] top-[-120px] -z-10 text-primary/25 md:right-[-40px] md:top-1/2 md:-translate-y-1/2">
        <GeometryMark className="h-[560px] w-[560px] md:h-[760px] md:w-[760px]" />
      </div>
      <div className="w-full max-w-[420px]">
        <Link href="/" className="mb-10 inline-flex min-h-11 items-center gap-2 text-base text-foreground-secondary hover:text-foreground"><ArrowLeft className="size-4" />返回首页</Link>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">登录管理后台</h1>
        <p className="mt-4 text-base leading-relaxed text-foreground-secondary">使用管理员账号，继续管理协会内容。</p>
        <form onSubmit={submit} className="mt-9 space-y-6">
          <div>
            <label htmlFor="username" className="mb-2 block text-base font-medium">账号</label>
            <input id="username" name="username" autoComplete="username" required maxLength={256} autoCapitalize="none" spellCheck={false} className="h-12 w-full rounded-md border border-border-strong bg-surface-1 px-4 text-base outline-none focus:border-accent" />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-base font-medium">密码</label>
            <div className="relative">
              <input id="password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" required maxLength={1024} className="h-12 w-full rounded-md border border-border-strong bg-surface-1 pl-4 pr-14 text-base outline-none focus:border-accent" />
              <button type="button" aria-label={visible ? "隐藏密码" : "显示密码"} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute right-1 top-0.5 flex size-11 items-center justify-center rounded text-foreground-secondary hover:text-foreground">{visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button>
            </div>
          </div>
          {error && <p role="alert" className="text-base leading-relaxed text-danger">{error}</p>}
          <button disabled={pending} type="submit" className="flex min-h-12 w-full items-center justify-center gap-3 rounded-md bg-foreground px-5 text-base font-semibold text-background hover:bg-white disabled:cursor-wait disabled:opacity-60">{pending ? "正在登录…" : "登录"}<ArrowRight className="size-4" /></button>
        </form>
      </div>
    </div>
  );
}

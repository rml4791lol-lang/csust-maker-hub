"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, Search, Shield } from "lucide-react";

export function TopBar({ onOpenCommand, onOpenMobile }: { onOpenCommand: () => void; onOpenMobile: () => void }) {
  const [sourceLabel, setSourceLabel] = useState("来源待核验");
  useEffect(() => {
    fetch("/api/meta", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("Metadata unavailable");
      return response.json();
    }).then((meta: { dataSource?: string }) => {
      setSourceLabel(meta.dataSource === "seed" ? "示例数据 · 待核验" : "录入数据 · 待核验");
    }).catch(() => {});
  }, []);
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-8">
      <button aria-label="打开导航" onClick={onOpenMobile} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-foreground-secondary hover:bg-surface-2 md:hidden"><Menu className="h-5 w-5" /></button>
      <button onClick={onOpenCommand} aria-label="搜索页面" className="flex h-11 w-11 shrink-0 items-center justify-center gap-2.5 rounded-md border border-border bg-surface-1 px-3 text-base text-foreground-secondary transition-colors hover:border-border-strong hover:text-foreground sm:w-full sm:max-w-[320px]">
        <Search className="h-4 w-4 shrink-0" /><span className="hidden flex-1 truncate text-left sm:inline">搜索页面…</span><kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-sm sm:inline">Ctrl K</kbd>
      </button>
      <div className="flex-1" />
      <span className="shrink-0 text-sm text-foreground-secondary">{sourceLabel}</span>
      <Link href="/admin" prefetch={false} aria-label="管理后台" className="hidden min-h-11 shrink-0 items-center gap-2 rounded-md px-2 text-sm text-foreground-secondary hover:bg-surface-2 sm:flex"><Shield className="h-4 w-4" /><span className="hidden lg:inline">管理后台</span></Link>
    </header>
  );
}

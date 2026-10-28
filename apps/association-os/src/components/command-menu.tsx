"use client";

import { useEffect, useRef, useState } from "react";
import { Award, BookOpen, CalendarDays, CornerDownLeft, FolderKanban, Footprints, Info, LayoutDashboard, Search, Trophy, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const commands = [
  { icon: LayoutDashboard, label: "首页", href: "/" },
  { icon: Footprints, label: "足迹", href: "/footprints" },
  { icon: BookOpen, label: "社区", href: "/library" },
  { icon: Users, label: "成员", href: "/members" },
  { icon: Trophy, label: "竞赛", href: "/competitions" },
  { icon: FolderKanban, label: "项目", href: "/projects" },
  { icon: CalendarDays, label: "活动", href: "/activities" },
  { icon: Award, label: "成果", href: "/achievements" },
  { icon: Info, label: "关于", href: "/about" },
  { icon: BookOpen, label: "发布中心", href: "/publish" },
];

export function CommandMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) { dialog.close(); return; }
    dialog.showModal();
    const timer = setTimeout(() => {
      setQuery("");
      setActiveIndex(0);
      inputRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [open]);

  const filtered = commands.filter((c) => c.label.includes(query.trim()));
  function run(href: string) { onClose(); router.push(href); }

  return (
    <dialog ref={dialogRef} aria-labelledby="command-title" className="command-dialog"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="overflow-hidden rounded-lg border border-border-strong bg-surface-2 shadow-elevated">
        <h2 id="command-title" className="sr-only">页面导航</h2>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-accent" />
          <input ref={inputRef} value={query} aria-label="搜索页面" placeholder="搜索页面名称…"
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1))); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); }
              if (e.key === "Enter" && filtered[activeIndex]) { e.preventDefault(); run(filtered[activeIndex].href); }
            }}
            className="h-14 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-foreground-muted" />
          <button aria-label="关闭页面导航" onClick={onClose} className="flex size-11 items-center justify-center text-foreground-secondary"><X className="size-4" /></button>
        </div>
        <ul className="max-h-[50dvh] overflow-y-auto p-2">
          {filtered.length === 0 && <li className="px-3 py-8 text-center text-sm text-foreground-secondary">没有匹配页面，试试“项目”或“足迹”</li>}
          {filtered.map((c, i) => {
            const Icon = c.icon;
            return <li key={c.href}><button onMouseEnter={() => setActiveIndex(i)} onClick={() => run(c.href)}
              className={cn("flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm", i === activeIndex ? "bg-primary-soft text-foreground" : "text-foreground-secondary")}>
              <Icon className={cn("size-4", i === activeIndex ? "text-accent" : "text-foreground-muted")} />
              <span className="flex-1">{c.label}</span>
              {i === activeIndex && <CornerDownLeft className="size-3.5" />}
            </button></li>;
          })}
        </ul>
        <div className="border-t border-border px-5 py-3 text-sm text-foreground-secondary">↑ ↓ 选择 · Enter 打开 · Esc 关闭</div>
      </div>
    </dialog>
  );
}

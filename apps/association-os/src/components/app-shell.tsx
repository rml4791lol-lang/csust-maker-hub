"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, Search, X, ArrowUpRight } from "lucide-react";
import { CommandMenu } from "@/components/command-menu";
import { AdminAuthProvider } from "@/components/admin-auth-provider";

const primary = [["/", "首页"], ["/library", "社区"], ["/projects", "项目"], ["/activities", "活动"], ["/achievements", "成果"], ["/about", "关于"]];
const secondary = [["/members", "成员"], ["/competitions", "竞赛"], ["/footprints", "足迹"]];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [source, setSource] = useState("数据来源待核验");
  const mobileRef = useRef<HTMLDialogElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const dialog = mobileRef.current;
    if (mobileOpen) dialog?.showModal(); else dialog?.close();
  }, [mobileOpen]);
  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [path]);
  useEffect(() => {
    fetch("/api/meta", { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(meta => setSource(meta.dataSource === "seed" ? "当前内容含示例数据，待协会核验" : "内容由协会录入，待核验" )).catch(() => {});
    const media = window.matchMedia("(min-width: 1100px)");
    const resize = () => { if (media.matches) setMobileOpen(false); };
    media.addEventListener("change", resize);
    function key(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setMobileOpen(false); setCommandOpen(v => !v);
      }
    }
    const open = () => setCommandOpen(true);
    window.addEventListener("keydown", key); window.addEventListener("dsh:open-command", open);
    return () => { media.removeEventListener("change", resize); window.removeEventListener("keydown", key); window.removeEventListener("dsh:open-command", open); };
  }, []);
  const isCurrent = (href: string) => href === "/" ? path === "/" : path.startsWith(href);
  return <AdminAuthProvider><div className="site-shell">
    <a href="#main-content" className="skip-link">跳到主要内容</a>
    <header className="site-header">
      <Link href="/" aria-label="AI 创客协会首页" className="site-brand"><span className="brand-glyph" aria-hidden>AI</span><span>创客协会</span></Link>
      <nav aria-label="主导航" className="site-primary">{primary.map(([href, label]) => <Link key={href} href={href} aria-current={isCurrent(href) ? "page" : undefined}>{label}</Link>)}</nav>
      <div className="site-actions"><button className="site-icon" aria-label="搜索页面" onClick={() => setCommandOpen(true)}><Search size={20} /></button><Link href="/publish" className="site-publish">发布中心<ArrowUpRight size={16} aria-hidden /></Link><button className="site-icon site-menu-trigger" aria-label="打开导航" onClick={() => setMobileOpen(true)}><Menu size={22} /></button></div>
    </header>
    <dialog ref={mobileRef} aria-label="主导航" className="site-mobile" onCancel={() => setMobileOpen(false)} onClick={e => { if (e.target === e.currentTarget) setMobileOpen(false); }}>
      <div className="flex items-center justify-between border-b border-border pb-5"><span className="text-xl font-semibold">AI 创客协会</span><button className="site-icon" aria-label="关闭导航" onClick={() => setMobileOpen(false)}><X size={22} /></button></div>
      <nav aria-label="移动导航">{[...primary, ...secondary, ["/publish", "发布中心"]].map(([href, label]) => <Link key={href} href={href} aria-current={isCurrent(href) ? "page" : undefined} onClick={() => setMobileOpen(false)}>{label}<ArrowUpRight size={18} aria-hidden /></Link>)}</nav>
    </dialog>
    <main ref={mainRef} id="main-content" tabIndex={-1} className="site-main"><p className="site-disclosure">{source}</p><div className="site-body">{children}</div>
      <footer className="site-footer"><div><Link href="/about" className="text-xl font-semibold">AI 创客协会</Link><p className="mt-3 text-base text-foreground-secondary">一起探索，一起动手。</p></div><nav aria-label="辅助导航">{secondary.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}<Link href="/publish">发布中心</Link></nav></footer>
    </main>
    <CommandMenu open={commandOpen} onClose={() => setCommandOpen(false)} />
  </div></AdminAuthProvider>;
}

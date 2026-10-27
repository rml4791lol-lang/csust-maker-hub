"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { CommandMenu } from "@/components/command-menu";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const mobileRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = mobileRef.current;
    if (!dialog) return;
    if (mobileOpen) dialog.showModal();
    else dialog.close();
  }, [mobileOpen]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const onResize = () => { if (media.matches) setMobileOpen(false); };
    media.addEventListener("change", onResize);
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMobileOpen(false);
        setCommandOpen((v) => !v);
      }
    }
    function onOpenCommand() { setCommandOpen(true); }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("dsh:open-command", onOpenCommand);
    return () => {
      media.removeEventListener("change", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("dsh:open-command", onOpenCommand);
    };
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden text-foreground">
      <a href="#main-content" className="skip-link">跳到主要内容</a>
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} onToggle={setCollapsed} />
      </div>
      <dialog
        ref={mobileRef}
        aria-label="主导航"
        className="mobile-navigation"
        onCancel={() => setMobileOpen(false)}
        onClick={(e) => { if (e.target === e.currentTarget) setMobileOpen(false); }}
      >
        <div className="relative h-full">
          <button className="absolute right-2 top-2 z-10 flex size-11 items-center justify-center rounded-md bg-surface-1 text-foreground-secondary"
            aria-label="关闭导航" onClick={() => setMobileOpen(false)}>
            <X className="size-4" />
          </button>
          <Sidebar collapsed={false} onToggle={setCollapsed} onNavigate={() => setMobileOpen(false)} />
        </div>
      </dialog>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenCommand={() => setCommandOpen(true)} onOpenMobile={() => setMobileOpen(true)} />
        <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
      <CommandMenu open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAuth } from "@/components/admin-auth-provider";
import {
  Award,
  BookOpen,
  CalendarDays,
  FolderKanban,
  Footprints,
  Info,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "首页", icon: LayoutDashboard, href: "/" },
  { label: "足迹", icon: Footprints, href: "/footprints" },
  { label: "内容库", icon: BookOpen, href: "/library" },
  { label: "成员", icon: Users, href: "/members" },
  { label: "竞赛", icon: Trophy, href: "/competitions" },
  { label: "项目", icon: FolderKanban, href: "/projects" },
  { label: "活动", icon: CalendarDays, href: "/activities" },
  { label: "成果", icon: Award, href: "/achievements" },
  { label: "关于", icon: Info, href: "/about" },
];

export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle: (v: boolean) => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { requireAdmin } = useAdminAuth();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-surface-1 transition-[width] duration-200 ease-standard",
        "w-60",
        collapsed ? "md:w-14" : "md:w-60",
      )}
    >
      {/* Logo */}
      <Link href="/" aria-label="AI 创客协会首页" onClick={onNavigate}
        className={cn(
          "flex h-16 items-center border-b border-border px-5",
          collapsed && "md:justify-center md:px-0",
        )}
      >
        {collapsed && <span className="hidden text-lg font-semibold tracking-tight text-foreground md:block">AI</span>}
        <div className={cn("min-w-0", collapsed && "md:hidden")}>
          <div className="truncate text-lg font-semibold tracking-tight text-foreground">
            AI 创客协会
          </div>
        </div>
      </Link>

      {/* Nav */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-fast",
                    collapsed && "md:justify-center md:px-0",
                    isActive(item.href)
                      ? "bg-primary-soft text-foreground"
                      : "text-foreground-secondary hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive(item.href)
                        ? "text-primary"
                        : "text-foreground-muted",
                    )}
                  />
                  <span
                    className={cn(
                      "flex-1 truncate",
                      collapsed && "md:hidden",
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2">
        <button
          onClick={() => { onNavigate?.(); void requireAdmin(() => router.push("/admin")); }}
          title={collapsed ? "编辑内容" : undefined}
          className={cn(
            "flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm text-foreground-secondary transition-colors duration-fast hover:bg-surface-2 hover:text-foreground",
            collapsed && "md:justify-center md:px-0",
          )}
        >
          <Settings className="h-4 w-4 shrink-0 text-foreground-muted" />
          <span className={cn(collapsed && "md:hidden")}>编辑内容</span>
        </button>
        <button
          aria-label={collapsed ? "展开导航" : "折叠导航"}
          onClick={() => onToggle(!collapsed)}
          className={cn(
            "mt-0.5 hidden min-h-11 w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm text-foreground-muted transition-colors duration-fast hover:bg-surface-2 hover:text-foreground-secondary md:flex",
            collapsed && "md:justify-center md:px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
          <span className={cn(collapsed && "md:hidden")}>折叠导航</span>
        </button>
      </div>
    </aside>
  );
}

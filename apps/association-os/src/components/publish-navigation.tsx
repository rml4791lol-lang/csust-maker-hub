"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONTENT_MODULES, type ContentModule } from "@/lib/content-modules";
import { publishHref } from "@/lib/publishing";

export function PublishNavigation() {
  const pathname = usePathname();
  return <div className="mx-auto w-full max-w-[1180px] px-4 pt-8 md:px-8 md:pt-10">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <Link href="/publish" className="min-h-11 content-center text-2xl font-semibold tracking-tight">发布中心</Link>
      <Link href="/" className="min-h-11 content-center text-base text-foreground-secondary hover:text-foreground">返回官网</Link>
    </div>
    <nav aria-label="发布模块" className="flex flex-wrap gap-x-1 border-b border-border">
      {(Object.keys(CONTENT_MODULES) as ContentModule[]).map((module) => {
        const href = publishHref(module);
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return <Link key={module} href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-12 items-center border-b-2 px-4 text-base transition-colors ${active ? "border-primary font-medium text-foreground" : "border-transparent text-foreground-secondary hover:border-border-strong hover:text-foreground"}`}>{module === "library" ? "社区文章" : CONTENT_MODULES[module].label}</Link>;
      })}
    </nav>
  </div>;
}

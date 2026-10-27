import Link from "next/link";
import { ArrowUpRight, FolderKanban } from "lucide-react";
import { StatusTag, type StatusTone } from "@/components/ui/status-tag";

export type PreviewProject = { name: string; owner: string; status: string; tone: StatusTone };

/** The glass surface is a live project view, backed by the same query as the board. */
export function ProductPreview({ projects, activeProjectCount }: { projects: PreviewProject[]; activeProjectCount: number }) {
  return (
    <section aria-label="项目速览" className="project-glass relative overflow-hidden rounded-xl border border-white/25 bg-white/[0.045] backdrop-blur-[14px]">
      <header className="flex items-center gap-2 border-b border-white/10 px-5 py-3.5">
        <FolderKanban className="h-4 w-4 text-accent" /><h2 className="text-base font-semibold">项目工作台</h2><span className="ml-auto text-sm text-foreground-secondary">{projects.length} 个项目</span>
      </header>
      <ul className="divide-y divide-white/10">
        {projects.slice(0, 4).map((project) => <li key={project.name}><Link href="/projects" className="flex min-h-[56px] items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.06]"><span className="min-w-0 flex-1 text-base font-medium">{project.name}</span><StatusTag label={project.status} tone={project.tone} /></Link></li>)}
      </ul>
      {!projects.length && <p className="px-5 py-10 text-sm text-foreground-secondary">还没有项目，等待新的想法。</p>}
      <Link href="/projects" className="flex min-h-12 items-center justify-between border-t border-white/10 px-5 text-sm text-foreground-secondary hover:bg-white/5"><span>{activeProjectCount} 个进行中 · 查看全部</span><ArrowUpRight className="h-4 w-4" /></Link>
    </section>
  );
}

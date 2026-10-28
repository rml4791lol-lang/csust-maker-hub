import Link from "next/link";
import { recordHref } from "@/lib/content-modules";
import { ArrowRight, BookOpen, CalendarDays, FolderKanban, Footprints, Trophy } from "lucide-react";
import { Hero } from "@/components/hero";
import { StatusTag } from "@/components/ui/status-tag";
import { getDashboardData } from "@/lib/dashboard-data";

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <Link href={href} aria-label={`查看全部${title}`} className="flex min-h-11 shrink-0 items-center gap-1 text-sm text-foreground-secondary hover:text-primary">查看全部<ArrowRight className="h-4 w-4" /></Link>
    </header>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-sm text-foreground-muted">{children}</p>;
}

export function Dashboard() {
  const data = getDashboardData();
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-6 md:px-8 md:pt-8">
      <Hero activeProjectCount={data.activeProjectCount} projects={data.projects} />
      <section aria-label="协会数据概览" className="mt-2 grid grid-cols-2 border-b border-border md:grid-cols-4">
        {data.metrics.map((metric, index) => (
          <Link key={metric.label} href={metric.href} className={`group px-4 py-4 transition-colors hover:bg-surface-2 md:px-5 ${index % 2 ? "border-l border-border" : ""} ${index >= 2 ? "border-t border-border md:border-t-0" : ""} ${index === 2 ? "md:border-l" : ""}`}>
            <div className="flex items-center justify-between gap-2 text-base text-foreground-secondary">{metric.label}<ArrowRight className="h-4 w-4 text-foreground-muted transition-transform group-hover:translate-x-0.5" /></div>
            <div className="mt-3 text-[36px] leading-none tracking-tight tabular-nums">{metric.value}</div>
          </Link>
        ))}
      </section>
      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[1.3fr_1fr]">
        <section className="panel overflow-hidden">
          <SectionHeader title="项目进展" href="/projects" />
          {data.projects.length ? <ul className="divide-y divide-border">
            {data.projects.slice(0, 4).map((project) => (
              <li key={project.id}><Link href={recordHref("projects", project.id)} className="flex min-h-[76px] items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2">
                <FolderKanban className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1"><p className="text-base font-medium">{project.name}</p><p className="mt-1 text-sm text-foreground-secondary">{project.owner} · {project.updated}</p></div>
                <StatusTag label={project.status} tone={project.tone} />
              </Link></li>
            ))}
          </ul> : <Empty>还没有项目，新的想法从这里开始。</Empty>}
        </section>
        <section className="panel overflow-hidden">
          <SectionHeader title="公开足迹" href="/footprints" />
          {data.footprints.length ? <ul className="divide-y divide-border">
            {data.footprints.map((footprint) => <li key={footprint.id}><Link href={recordHref("footprints", footprint.id)} className="flex gap-3 px-5 py-4 transition-colors hover:bg-surface-2">
              <Footprints className="mt-1 h-4 w-4 shrink-0 text-accent" />
              <div className="min-w-0 flex-1"><p className="line-clamp-2 text-base leading-relaxed">{footprint.content}</p><p className="mt-2 text-sm leading-relaxed text-foreground-secondary">{footprint.member} · {footprint.date}{footprint.project ? ` · ${footprint.project}` : ""}</p></div>
            </Link></li>)}
          </ul> : <Empty>暂无公开足迹，欢迎记录一次实践。</Empty>}
          <Link href="/footprints" className="flex min-h-12 items-center justify-between border-t border-border px-5 text-sm text-primary hover:bg-primary/5">浏览更多足迹<ArrowRight className="h-4 w-4" /></Link>
        </section>
      </div>
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold">社区文章</h2><Link href="/library" className="flex min-h-11 items-center gap-1 text-sm text-foreground-secondary hover:text-primary">进入社区<ArrowRight className="h-4 w-4" /></Link></div>
        {data.resources.length ? <div className="grid gap-4 lg:grid-cols-3">
          {data.resources.map((resource) => <Link key={resource.id} href={recordHref("library", resource.id)} className="group panel p-5 transition-colors hover:border-border-strong hover:bg-surface-2">
            <div className="flex items-center justify-between"><BookOpen className="h-4 w-4 text-primary" /><ArrowRight className="h-4 w-4 text-foreground-muted transition-transform group-hover:translate-x-0.5" /></div>
            <h3 className="mt-4 text-lg font-semibold leading-relaxed">{resource.title}</h3><p className="mt-2 line-clamp-2 text-base leading-relaxed text-foreground-secondary">{resource.summary}</p><p className="mt-4 text-sm text-foreground-secondary">{resource.author} · {resource.updated}</p>
          </Link>)}
        </div> : <Empty>社区内容等待收录。</Empty>}
      </section>
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
        <section className="panel overflow-hidden">
          <SectionHeader title="活动与竞赛" href="/activities" />
          <ul className="divide-y divide-border">
            {data.events.slice(0, 2).map((event) => <li key={event.id}><Link href={recordHref("activities", event.id)} className="flex items-center gap-3 px-5 py-4 hover:bg-surface-2"><CalendarDays className="h-4 w-4 shrink-0 text-foreground-muted" /><div className="min-w-0 flex-1"><p className="text-base">{event.title}</p><p className="mt-1 text-sm text-foreground-secondary">{event.date} · {event.place}</p></div><span className="shrink-0 text-sm text-foreground-secondary">{event.status}</span></Link></li>)}
            {data.competitions.slice(0, 1).map((competition) => <li key={competition.id}><Link href={recordHref("competitions", competition.id)} className="flex items-center gap-3 px-5 py-4 hover:bg-surface-2"><Trophy className="h-4 w-4 shrink-0 text-foreground-muted" /><div className="min-w-0 flex-1"><p className="text-base">{competition.name}</p><p className="mt-1 text-sm text-foreground-secondary">截止日期 {competition.deadline}</p></div><span className="shrink-0 text-sm text-foreground-secondary">{competition.status}</span></Link></li>)}
          </ul>
          {!data.events.length && !data.competitions.length && <Empty>暂无活动与竞赛记录。</Empty>}
        </section>
        <section className="panel overflow-hidden">
          <SectionHeader title="部门协作" href="/about" />
          {data.departments.length ? <ul className="divide-y divide-border">{data.departments.map((dept) => <li key={dept.name} className="flex flex-wrap items-center gap-3 px-5 py-4"><span className="flex-1 text-base">{dept.name}</span><span className="text-sm text-foreground-secondary">{dept.active} 位成员</span><span className="text-sm text-foreground-secondary">{dept.contributions} 条足迹</span></li>)}</ul> : <Empty>部门信息等待录入。</Empty>}
        </section>
      </div>
    </div>
  );
}

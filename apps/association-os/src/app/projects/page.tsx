import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { StatusTag, type StatusTone } from "@/components/ui/status-tag";
import { getProjectStatusFlow, listProjects } from "@/lib/queries";
import { cn } from "@/lib/utils";

const statusTone: Record<string, StatusTone> = {
  立项: "neutral",
  开发中: "info",
  答辩准备: "warning",
  已结项: "success",
  孵化中: "primary",
};

/** 状态 → 列顶色 */
const columnTone: Record<string, string> = {
  立项: "bg-foreground-muted",
  开发中: "bg-primary",
  答辩准备: "bg-warning",
  已结项: "bg-success",
  孵化中: "bg-accent",
};

export const instant = false;

export default async function ProjectsPage() {
  await connection();
  const projects = listProjects();
  const statusFlow = getProjectStatusFlow();
  const grouped = statusFlow.map((s) => ({
    ...s,
    items: projects.filter((p) => p.status === s.label),
  }));

  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 py-8 md:px-8">
      <PageHeader
        title="项目"
        description={`${projects.length} 个项目 · 5 个阶段`}
      />

      {/* 状态轨道 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {grouped.map((col) => (
          <section
            key={col.label}
            className="overflow-hidden panel"
          >
            {/* 列头 */}
            <header className="border-b border-border">
              <div className={cn("h-0.5 w-full", columnTone[col.label])} />
              <div className="flex items-center justify-between px-4 py-3">
                <StatusTag label={col.label} tone={statusTone[col.label] ?? "neutral"} />
                <span className="num text-[20px] leading-none text-foreground">
                  {col.items.length}
                </span>
              </div>
            </header>

            {/* 卡片 */}
            <ul className="divide-y divide-border">
              {col.items.length === 0 ? (
                <li className="px-4 py-6 text-center text-[14px] text-foreground-muted">
                  暂无
                </li>
              ) : (
                col.items.map((p) => (
                  <li
                    key={p.name}
                    className="px-4 py-3 transition-colors duration-fast hover:bg-surface-3/50"
                  >
                    <div className="text-[18px] font-medium leading-snug text-foreground">
                      {p.name}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="text-[14px] text-foreground-muted">
                        {p.owner}
                      </span>
                      <span className="text-[14px] tabular-nums text-foreground-muted">
                        {p.updated}
                      </span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

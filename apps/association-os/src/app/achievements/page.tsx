import { connection } from "next/server";
import Link from "next/link";
import { recordHref } from "@/lib/content-modules";
import { FileCheck, FileWarning } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { listAwards } from "@/lib/queries";
import { cn } from "@/lib/utils";

const LEVELS = ["国家级", "省级", "校级"];

const levelStyle: Record<
  string,
  { bar: string; text: string; bg: string; border: string }
> = {
  国家级: {
    bar: "bg-warning",
    text: "text-warning",
    bg: "bg-warning/8",
    border: "border-warning/25",
  },
  省级: {
    bar: "bg-primary",
    text: "text-primary",
    bg: "bg-primary/8",
    border: "border-primary/25",
  },
  校级: {
    bar: "bg-foreground-muted",
    text: "text-foreground-muted",
    bg: "bg-white/[0.03]",
    border: "border-border",
  },
};

export const instant = false;

export default async function AchievementsPage() {
  await connection();
  const awardList = listAwards();
  const certCount = awardList.filter((a) => a.has_certificate === 1).length;
  const displayLevels = [...LEVELS, ...Array.from(new Set(awardList.map(a => a.level).filter(level => !LEVELS.includes(level))))];

  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 py-8 md:px-8">
      <PageHeader
        title="成果"
        description={`${awardList.length} 项获奖 · ${certCount} 项登记有证书`}
       />

      {/* 汇总带（补齐顶部空区） */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {LEVELS.map((level) => {
          const count = awardList.filter((a) => a.level === level).length;
          const s = levelStyle[level];
          return (
            <div
              key={level}
              className={cn(
                "relative overflow-hidden rounded-lg border bg-surface-2 px-5 py-4",
                s.border,
              )}
            >
              <span className={cn("absolute inset-x-0 top-0 h-0.5", s.bar)} />
              <div className="num text-[36px] leading-none text-foreground">
                {count}
              </div>
              <div
                className={cn(
                  "mt-2 text-[14px]",
                  s.text,
                )}
              >
                {level}
              </div>
            </div>
          );
        })}
        <div className="relative overflow-hidden rounded-lg border border-success/25 bg-surface-2 px-5 py-4">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-success" />
          <div className="num text-[36px] leading-none text-foreground">
            {certCount}
          </div>
          <div className="mt-2 text-[14px] text-success">
            已登记有证书
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {displayLevels.map((level) => {
          const group = awardList.filter((a) => a.level === level);
          if (group.length === 0) return null;
          const s = levelStyle[level] ?? levelStyle["校级"];

          return (
            <section key={level}>
              {/* 级别标题 */}
              <div className="mb-3 flex items-center gap-3">
                <span className={cn("h-px flex-1", s.bar, "opacity-40")} />
                <h2
                  className={cn(
                    "text-[20px] font-semibold",
                    s.text,
                  )}
                >
                  {level || "待分类"} · {group.length}
                </h2>
                <span className={cn("h-px flex-1", s.bar, "opacity-40")} />
              </div>

              {/* 奖状墙 */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {group.map((a) => (
                  <article
                    key={a.id}
                    className={cn(
                      "relative overflow-hidden rounded-lg border bg-surface-2",
                      s.border,
                    )}
                  >
                    {/* 左侧绶带 */}
                    <span
                      className={cn(
                        "absolute inset-y-0 left-0 w-1",
                        s.bar,
                      )}
                    />
                    <div className="pl-6 pr-5 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className={cn("text-[14px]", s.text)}>
                            {a.competition}
                          </div>
                          <h3 className="mt-1.5 text-[18px] font-semibold leading-snug text-foreground">
                            <Link className="inline-flex min-h-11 items-center hover:text-primary" href={recordHref("achievements", a.id)}>{a.title}</Link>
                          </h3>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded px-2 py-1 text-[14px] tabular-nums",
                            s.bg,
                            s.text,
                          )}
                        >
                          {a.date}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <span className="text-[16px] text-foreground-secondary">
                          {a.members.join(" / ")}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-[14px]",
                            a.has_certificate === 1
                              ? "text-success"
                              : "text-foreground-muted",
                          )}
                        >
                          {a.has_certificate === 1 ? (
                            <FileCheck className="h-4 w-4 shrink-0" />
                          ) : (
                            <FileWarning className="h-4 w-4 shrink-0" />
                          )}
                          {a.has_certificate === 1 ? "已登记有证书" : "待补证书"}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {awardList.length === 0 && <p className="border-y border-border py-12 text-base text-foreground-secondary">尚未登记成果。</p>}
    </div>
  );
}

import { connection } from "next/server";
import Link from "next/link";
import { recordHref } from "@/lib/content-modules";
import { EmptyState, PageHeader } from "@/components/page-header";
import { StatusTag, type StatusTone } from "@/components/ui/status-tag";
import { listCompetitions } from "@/lib/queries";

const statusTone: Record<string, StatusTone> = {
  报名中: "info",
  备赛中: "warning",
  待核验: "neutral",
  已结束: "neutral",
};

export const instant = false;

export default async function CompetitionsPage() {
  await connection();
  const competitions = listCompetitions();
  const top = competitions[0];
  const totalTeams = competitions.reduce((sum, item) => sum + item.teams, 0);

  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 py-8 md:px-8">
      <PageHeader
        title="竞赛"
        description={`${competitions.length} 场赛事 · ${totalTeams} 支队伍`}
       />

      {top ? (
        <>
          <section className="mb-8 overflow-hidden rounded-lg border border-primary/35 bg-surface-2">
            <div className="h-1 bg-primary" />
            <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold leading-tight"><Link className="inline-block min-h-11 hover:text-primary" href={recordHref("competitions", top.id)}>{top.name}</Link></h2>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-base text-foreground-secondary">{top.level} · {top.host}</span>
                  <StatusTag label={top.status} tone={statusTone[top.status] ?? "neutral"} />
                </div>
                <p className="mt-4 text-base text-foreground-secondary">
                  参赛成员：{top.members.length ? top.members.join(" / ") : "待登记"}
                </p>
              </div>
              <div className="shrink-0 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                <p className="text-base text-foreground-secondary">截止日期</p>
                <p className="mt-2 text-4xl tabular-nums">{top.deadline || "待公布"}</p>
              </div>
            </div>
          </section>

          <ul className="panel divide-y divide-border overflow-hidden">
            {competitions.slice(1).map((competition) => (
              <li key={competition.id} className="flex flex-wrap items-center gap-4 px-5 py-5">
                <div className="min-w-0 flex-[1_1_240px]">
                  <h2 className="text-lg font-semibold"><Link className="inline-flex min-h-11 items-center hover:text-primary" href={recordHref("competitions", competition.id)}>{competition.name}</Link></h2>
                  <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
                    {competition.level} · {competition.host} · {competition.teams} 支队伍
                  </p>
                  {competition.members.length > 0 && (
                    <p className="mt-2 text-sm text-foreground-secondary">{competition.members.join(" / ")}</p>
                  )}
                </div>
                <StatusTag label={competition.status} tone={statusTone[competition.status] ?? "neutral"} />
                <p className="text-base tabular-nums text-foreground-secondary">
                  截止 {competition.deadline || "待公布"}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState text="暂无赛事，等待新的挑战。" />
      )}
    </div>
  );
}

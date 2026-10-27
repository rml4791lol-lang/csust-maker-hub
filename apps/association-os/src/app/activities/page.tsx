import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { StatusTag, type StatusTone } from "@/components/ui/status-tag";
import { listActivities } from "@/lib/queries";
import { cn } from "@/lib/utils";

const statusTone: Record<string, StatusTone> = {
  报名中: "info",
  待开始: "neutral",
  已结束: "neutral",
};

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

const kindLabel: Record<string, string> = {
  training: "培训",
  meeting: "会议",
  sharing: "分享",
  activity: "活动",
};

const kindTone: Record<string, string> = {
  training: "text-primary",
  meeting: "text-foreground-muted",
  sharing: "text-accent",
  activity: "text-success",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function getWeekDays() {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      date: d,
      label: WEEK_LABELS[i],
      mmdd: `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      isToday:
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate(),
    };
  });
}

/** 本周日期依赖「今天」，允许阻塞式动态渲染 */
export const instant = false;

export default async function ActivitiesPage() {
  // 本周日期依赖「今天」，必须动态渲染（否则预渲染时 new Date() 会报错）
  await connection();
  const activityList = listActivities();
  const week = getWeekDays();
  const weekRange = `${week[0].mmdd} — ${week[6].mmdd}`;

  const columns = week.map((day) => ({
    ...day,
    items: activityList.filter((a) => a.date.startsWith(day.mmdd)),
  }));

  const upcoming = activityList.filter(
    (a) => !week.some((d) => a.date.startsWith(d.mmdd)),
  );

  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 py-8 md:px-8">
      <PageHeader
        title="活动"
        description={`${weekRange} · ${activityList.length} 场活动`}
      />

      {/* 本周周历 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {columns.map((day) => (
          <section
            key={day.mmdd}
            className={cn(
              "flex min-h-[220px] flex-col overflow-hidden rounded-lg border bg-surface-2",
              day.isToday ? "border-primary/50" : "border-border",
            )}
          >
            {/* 日期头 */}
            <header
              className={cn(
                "flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b px-3 py-2",
                day.isToday
                  ? "border-primary/30 bg-primary/10"
                  : "border-border",
              )}
            >
              <span
                className={cn(
                  "text-[16px] font-semibold",
                  day.isToday ? "text-primary" : "text-foreground",
                )}
              >
                周{day.label}
              </span>
              <span
                className={cn(
                  "text-[14px] tabular-nums",
                  day.isToday ? "text-primary" : "text-foreground-muted",
                )}
              >
                {day.mmdd}
              </span>
            </header>

            {/* 当日活动 */}
            <div className="flex-1 space-y-2 p-2">
              {day.items.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded border border-dashed border-border/70 text-[14px] text-foreground-muted">
                  无安排
                </div>
              ) : (
                day.items.map((a) => {
                  const pct = Math.round((a.joined / a.capacity) * 100);
                  return (
                    <div
                      key={a.id}
                      className="rounded border border-border bg-surface-3/60 p-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <span
                          className={cn(
                            "text-[14px]",
                            kindTone[a.kind],
                          )}
                        >
                          {kindLabel[a.kind]}
                        </span>
                        <span className="text-[14px] tabular-nums text-foreground-muted">
                          {a.date.slice(6)}
                        </span>
                      </div>
                      <div className="mt-2 break-words text-[18px] font-medium leading-snug text-foreground">
                        {a.title}
                      </div>
                      <div className="mt-1 break-words text-[14px] text-foreground-muted">
                        {a.place}
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-border">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-[14px] tabular-nums text-foreground-muted">
                          {a.joined}/{a.capacity}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        ))}
      </div>

      {/* 非本周活动 */}
      {upcoming.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-3 text-[20px] font-semibold text-foreground">
            其他日程
          </h2>
          <ul className="divide-y divide-border overflow-hidden panel">
            {upcoming.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <span className="shrink-0 text-[14px] tabular-nums text-foreground-muted">
                  {a.date}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[14px]",
                    kindTone[a.kind],
                  )}
                >
                  {kindLabel[a.kind]}
                </span>
                <span className="min-w-0 flex-[1_1_180px] break-words text-[18px] font-medium text-foreground">
                  {a.title}
                </span>
                <span className="hidden text-[14px] text-foreground-muted sm:block">
                  {a.place}
                </span>
                <StatusTag label={a.status} tone={statusTone[a.status] ?? "neutral"} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

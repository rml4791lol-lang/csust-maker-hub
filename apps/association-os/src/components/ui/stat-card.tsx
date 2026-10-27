import { Sparkline } from "@/components/charts";

export function StatCard({
  label,
  value,
  trend,
  spark,
}: {
  label: string;
  value: string;
  trend: string;
  spark: number[];
}) {
  const positive = trend.startsWith("+");
  return (
    <div className="panel px-4 py-3">
      <div className="text-sm text-foreground-muted">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <span className="text-[28px] font-medium leading-none tracking-tight text-foreground tabular-nums">
          {value}
        </span>
        <span
          className={
            positive
              ? "text-sm font-medium text-success tabular-nums"
              : "text-sm text-foreground-muted tabular-nums"
          }
        >
          {trend}
        </span>
      </div>
      <div className="mt-3">
        <Sparkline data={spark} />
      </div>
    </div>
  );
}

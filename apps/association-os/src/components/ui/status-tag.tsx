import { cn } from "@/lib/utils";

export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "primary";

/** Status is conveyed by readable words, without decorative dots or glow. */
const styles: Record<StatusTone, string> = {
  success: "text-emerald-200/90",
  warning: "text-amber-200/90",
  danger: "text-red-300",
  info: "text-blue-200/90",
  neutral: "text-foreground-secondary",
  primary: "text-blue-200/90",
};

export function StatusTag({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: StatusTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center py-1 text-sm font-medium leading-snug",
        styles[tone],
      )}
    >
      {label}
    </span>
  );
}

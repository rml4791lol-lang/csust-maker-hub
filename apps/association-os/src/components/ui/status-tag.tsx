import { cn } from "@/lib/utils";

export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "primary";

/**
 * 状态标签（v3 方案 §2.5）：淡底 + 色点 + 文字。
 * 淡底负责提供「面状 accent」，消除纯灰度 AI 味。
 */
const styles: Record<
  StatusTone,
  { bg: string; dot: string; text: string }
> = {
  success: { bg: "bg-success/10", dot: "bg-success", text: "text-success" },
  warning: { bg: "bg-warning/10", dot: "bg-warning", text: "text-warning" },
  danger: { bg: "bg-danger/10", dot: "bg-danger", text: "text-danger" },
  info: { bg: "bg-primary/12", dot: "bg-primary", text: "text-primary" },
  neutral: {
    bg: "bg-white/5",
    dot: "bg-foreground-muted",
    text: "text-foreground-muted",
  },
  primary: { bg: "bg-primary/12", dot: "bg-primary", text: "text-primary" },
};

export function StatusTag({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: StatusTone;
}) {
  const s = styles[tone];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-sm font-medium leading-snug",
        s.bg,
        s.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {label}
    </span>
  );
}

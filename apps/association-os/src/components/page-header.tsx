import { GeometryMark } from "@/components/geometry-mark";

/** Shared title band carries the Hero's geometric language into product pages. */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative isolate mb-8 flex min-h-[140px] flex-col justify-center gap-4 overflow-hidden border-b border-border py-6 md:min-h-[164px] md:py-7 lg:flex-row lg:items-center lg:justify-between">
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 -right-16 w-[250px] opacity-65 sm:right-0 sm:w-[380px] sm:opacity-90">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(87,151,255,0.12),transparent_70%)]" />
        <GeometryMark className="absolute -top-[52px] right-0 h-[250px] w-[250px] sm:-top-[110px] sm:h-[380px] sm:w-[380px]" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/35 to-transparent" />
      </div>
      <div className="relative z-10 min-w-0">
        <h1 className="page-title text-foreground">{title}</h1>
        {description && (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground-secondary">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="relative z-10 flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}

/** 筛选 chip */
export function FilterChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? "inline-flex min-h-11 items-center gap-2 rounded-md border border-primary/40 bg-primary/15 px-3 py-2 text-sm font-medium text-primary"
          : "inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground-secondary transition-colors duration-fast hover:border-border-strong hover:text-foreground"
      }
    >
      {label}
      {count !== undefined && (
        <span className="tabular-nums">{count}</span>
      )}
    </button>
  );
}

/** 页面空状态 */
export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16">
      <p className="px-4 text-base text-foreground-secondary">{text}</p>
    </div>
  );
}

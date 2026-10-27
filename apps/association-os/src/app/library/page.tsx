"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { PageHeader, FilterChip, EmptyState } from "@/components/page-header";
import { Reveal } from "@/components/reveal";
import { contentTypes, topics } from "@/lib/mock-data";
import type { ItemRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

export default function LibraryPage() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [type, setType] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/items", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Unable to load resources");
        return r.json();
      })
      .then((data: unknown) => {
        setItems(Array.isArray(data) ? (data as ItemRow[]) : []);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const filtered = items.filter(
    (i) =>
      (!type || i.type === type) &&
      (!topic || i.topic === topic) &&
      (!q ||
        i.title.toLowerCase().includes(q.toLowerCase()) ||
        i.summary.toLowerCase().includes(q.toLowerCase()) ||
        i.tags.some((t) => t.toLowerCase().includes(q.toLowerCase()))),
  );

  const featured = items[0];

  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 py-8 md:px-8">
      <PageHeader
        title="内容库"
      />

      {/* Small screens keep the same categories within reach of the results. */}
      <div aria-label="内容类型" className="mb-6 flex flex-wrap gap-2 md:grid md:grid-cols-5 md:gap-px md:overflow-hidden md:rounded-lg md:border md:border-border md:bg-border">
        {contentTypes.map((ct) => {
          const active = type === ct.key;
          return (
            <button
              key={ct.key}
              aria-pressed={active}
              onClick={() => setType(active ? null : ct.key)}
              className={cn(
                "group relative flex min-h-12 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-left transition-colors duration-fast md:block md:rounded-none md:border-0 md:px-5 md:py-5",
                active ? "bg-primary/10" : "hover:bg-surface-3",
              )}
            >
              <div
                className={cn(
                  "hidden font-display text-[40px] font-bold leading-none transition-colors md:block",
                  active
                    ? "text-primary"
                    : "text-foreground/12 group-hover:text-primary/35",
                )}
              >
                {ct.plate}
              </div>
              <div className="text-base font-semibold text-foreground md:mt-3">
                {ct.label}
              </div>
              <div className="text-sm tabular-nums text-foreground-secondary md:mt-1">
                {items.filter((item) => item.type === ct.key).length} 条
              </div>
              {active && (
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* 精选大卡 */}
      {featured && (
        <Reveal>
          <div className="mb-8 hidden overflow-hidden rounded-lg border border-primary/25 bg-[linear-gradient(100deg,rgba(61,123,253,0.12),transparent_60%)] md:block">
          <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="font-display text-[24px] font-bold leading-tight text-foreground">
                {featured.title}
              </h2>
              <p className="prose-cn mt-2 max-w-xl text-foreground-secondary">
                {featured.summary}
              </p>
              <div className="mt-4">
                <span className="text-sm text-foreground-secondary">
                  {featured.author} · {featured.updated}
                </span>
              </div>
            </div>
            <a href="#library-results" className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-base font-medium text-background transition-colors duration-fast hover:bg-primary-hover">
              浏览条目
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        </Reveal>
      )}

      {/* 搜索 + 筛选 */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            value={q}
            aria-label="搜索内容"
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索标题、摘要、标签…"
            className="h-12 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-base text-foreground outline-none transition-colors placeholder:text-foreground-muted focus:border-primary/50"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            label="全部主题"
            active={topic === null}
            onClick={() => setTopic(null)}
          />
          {topics.map((t) => (
            <FilterChip
              key={t.key}
              label={t.label}
              active={topic === t.key}
              onClick={() => setTopic(topic === t.key ? null : t.key)}
            />
          ))}
        </div>
      </div>

      {/* 结果 */}
      <div id="library-results" className="mb-3 flex scroll-mt-4 items-center justify-between">
        <span aria-live="polite" className="text-sm text-foreground-secondary">
          {filtered.length} 条结果
        </span>
      </div>

      {loading ? (
        <EmptyState text="正在加载内容…" />
      ) : error ? (
        <EmptyState text="内容加载失败，请刷新重试" />
      ) : filtered.length === 0 ? (
        <EmptyState text="没有匹配的内容，试试清空筛选" />
      ) : (
        <ul className="divide-y divide-border overflow-hidden panel">
          {filtered.map((item) => {
            const ct = contentTypes.find((c) => c.key === item.type);
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-start gap-3 px-4 py-5 md:flex-nowrap md:gap-4 md:px-5"
              >
                <span aria-hidden="true" className="mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-surface-3 font-display text-lg font-bold text-primary md:flex">
                  {ct?.plate}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-medium leading-relaxed text-foreground">
                    {item.title}
                  </div>
                  <p className="mt-2 line-clamp-2 text-base leading-relaxed text-foreground-secondary">
                    {item.summary}
                  </p>
                </div>
                <div className="flex w-full shrink-0 items-center gap-3 text-sm text-foreground-secondary md:w-auto md:pt-1">
                  <span>
                    {item.author}
                  </span>
                  <span className="tabular-nums">
                    {item.updated}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

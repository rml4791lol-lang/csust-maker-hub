"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader, FilterChip, EmptyState } from "@/components/page-header";
import type { DepartmentRow, MemberRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

const deptColor: Record<string, string> = {
  技术部: "bg-primary",
  竞赛部: "bg-warning",
  宣传部: "bg-accent",
  创新创业部: "bg-success",
};

export default function MembersPage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [dept, setDept] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all(
      ["/api/members", "/api/departments"].map((url) => fetch(url, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error("Unable to load members");
        return r.json();
      })),
    )
      .then(([m, d]: unknown[]) => {
        setMembers(Array.isArray(m) ? (m as MemberRow[]) : []);
        setDepartments(Array.isArray(d) ? (d as DepartmentRow[]) : []);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const filtered = members.filter(
    (m) =>
      (!dept || m.dept === dept) &&
      (!q ||
        m.name.includes(q) ||
        m.skills.some((s) => s.includes(q)) ||
        m.dept.includes(q)),
  );

  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 py-8 md:px-8">
      <PageHeader
        title="成员"
        description={`${members.length} 名在册成员 · ${departments.length} 个部门`}
      />

      {/* 搜索 + 部门筛选 */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索姓名、技能、部门…"
            className="h-11 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-[16px] text-foreground outline-none transition-colors placeholder:text-foreground-muted focus:border-primary/50"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            label="全部"
            active={dept === null}
            count={members.length}
            onClick={() => setDept(null)}
          />
          {departments.map((d) => (
            <FilterChip
              key={d.name}
              label={d.name}
              count={d.active}
              active={dept === d.name}
              onClick={() => setDept(dept === d.name ? null : d.name)}
            />
          ))}
        </div>
      </div>

      {/* 名册 */}
      {loading ? (
        <EmptyState text="正在加载成员…" />
      ) : error ? (
        <EmptyState text="成员加载失败，请刷新重试" />
      ) : filtered.length === 0 ? (
        <EmptyState text="没有匹配的成员" />
      ) : (
        <ul className="divide-y divide-border overflow-hidden panel">
          {filtered.map((m) => {
            return (
              <li
                key={m.id}
                className="group flex items-center gap-4 px-5 py-3.5 transition-colors duration-fast hover:bg-surface-3/40"
              >
                <span
                  className={cn(
                    "h-9 w-[3px] shrink-0 rounded-full",
                    deptColor[m.dept] ?? "bg-border-strong",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[18px] font-semibold text-foreground">
                      {m.name}
                    </span>
                    {m.role && (
                      <span className="rounded bg-primary/12 px-2 py-0.5 text-[14px] text-primary">
                        {m.role}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[14px] text-foreground-muted">
                    {m.dept} · {m.grade}
                  </div>
                </div>
                <div className="hidden max-w-[45%] flex-wrap justify-end gap-1.5 sm:flex">
                  {m.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded border border-border bg-surface-3 px-2 py-0.5 text-[14px] text-foreground-muted"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

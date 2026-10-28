"use client";

import { useCallback, useEffect, useState } from "react";
import { LogOut, Plus, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  TABLE_DEFS,
  TABLE_KEYS,
  type FieldDef,
  type TableDef,
} from "@/lib/admin-schema";
import { cn } from "@/lib/utils";

type Row = Record<string, unknown>;

async function adminFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (response.status === 401) {
    window.dispatchEvent(new Event("association:reauthenticate"));
    throw new Error("登录已失效，已保留当前输入。重新登录后请再次保存。");
  }
  return response;
}

export default function AdminPage() {
  const [active, setActive] = useState<string>("members");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<{
    dataSource: string;
    seededAt: string | null;
  } | null>(null);

  const def = TABLE_DEFS[active];
  const loading = rows === null;

  const [deptOptions, setDeptOptions] = useState<string[]>([]);

  // 数据来源标记
  useEffect(() => {
    fetch("/api/meta", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: unknown) => {
        setMeta(d as { dataSource: string; seededAt: string | null });
      })
      .catch(() => {});
    // 部门选项来自数据库（不硬编码，新增部门后自动出现）
    fetch("/api/departments", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: unknown) => {
        if (Array.isArray(d)) {
          setDeptOptions(
            d.map((x: { name: string }) => x.name).filter(Boolean),
          );
        }
      })
      .catch(() => {});
  }, []);

  /** 重新拉取（保存/删除后调用；effect 内不直接调用以避免同步 setState） */
  const reload = useCallback(async () => {
    try {
      const res = await adminFetch(`/api/admin/${active}`, { cache: "no-store" });
      if (!res.ok) throw new Error("加载失败");
      const data = (await res.json()) as unknown;
      setRows(Array.isArray(data) ? (data as Row[]) : []);
    } catch {
      setRows([]);
      setError("加载失败");
    }
  }, [active]);

  useEffect(() => {
    let cancelled = false;
    adminFetch(`/api/admin/${active}`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("加载失败"); return r.json(); })
      .then((data: unknown) => {
        if (cancelled) return;
        setRows(Array.isArray(data) ? (data as Row[]) : []);
      })
      .catch(() => {
        if (!cancelled) { setRows([]); setError("加载失败，请刷新重试"); }
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  async function save(values: Row, original: Row | null) {
    const isEdit = original !== null;
    const url = isEdit
      ? `/api/admin/${active}/${String(original[def.pk])}`
      : `/api/admin/${active}`;
    try {
      const res = await adminFetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "保存失败");
      }
      setEditing(null);
      setError("");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败，请重试");
    }
  }

  async function remove(id: unknown) {
    if (!window.confirm("确定删除这一条？")) return;
    try {
      const res = await adminFetch(`/api/admin/${active}/${String(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
      setError("");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败，请重试");
    }
  }

  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      window.location.replace("/");
    } catch { setError("退出失败，请重试"); }
  }

  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 py-8 md:px-8">
      <PageHeader
        title="管理后台"
        description={
          meta?.dataSource === "seed"
            ? "当前为示例数据（seed），可在下方增删改为真实数据"
            : meta?.dataSource === "cleared"
              ? "示例数据已清空，等待录入真实数据"
              : "数据来源未标记"
        }
      >
        <button onClick={logout} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-base text-foreground-secondary hover:text-foreground"><LogOut className="size-4" />退出登录</button>
        <button
          onClick={() => setEditing({})}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-base font-medium text-background transition-colors hover:bg-primary-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          新增
        </button>
      </PageHeader>

      {/* 模块标签 */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {TABLE_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => {
              setActive(k);
              setEditing(null);
            }}
            className={cn(
              "rounded-md border px-3 py-1.5 text-base transition-colors",
              active === k
                ? "border-primary/40 bg-primary/15 font-medium text-primary"
                : "border-border bg-surface-2 text-foreground-secondary hover:text-foreground",
            )}
          >
            {TABLE_DEFS[k].label}
            {active === k && rows !== null && (
              <span className="num ml-1.5 text-sm opacity-60">
                {rows.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-base text-danger">
          {error}
        </div>
      )}

      {/* 表格 */}
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-border">
              {def.fields.slice(0, 5).map((f) => (
                <th
                  key={f.key}
                  className="whitespace-nowrap px-4 py-2.5 text-sm text-foreground-muted"
                >
                  {f.label}
                </th>
              ))}
              <th className="w-20 px-4 py-2.5 text-right text-sm text-foreground-muted">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-base text-foreground-muted"
                >
                  加载中…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-base text-foreground-muted"
                >
                  暂无数据，点右上角「新增」
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={String(r[def.pk] ?? i)}
                  className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-3/40"
                >
                  {def.fields.slice(0, 5).map((f) => (
                    <td
                      key={f.key}
                      className="max-w-[260px] truncate px-4 py-2.5 text-base text-foreground"
                    >
                      {formatCell(r[f.key], f)}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(r)}
                        className="rounded px-2 py-1 text-sm text-foreground-secondary transition-colors hover:bg-surface-3 hover:text-foreground"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => remove(r[def.pk])}
                        className="rounded px-2 py-1 text-danger/70 transition-colors hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 表单弹窗 */}
      {editing !== null && (
        <FormModal
          def={def}
          initial={editing}
          deptOptions={deptOptions}
          onClose={() => setEditing(null)}
          onSave={(values) =>
            save(values, Object.keys(editing).length ? editing : null)
          }
        />
      )}

      {/* 审计日志 */}
      <AuditSection />
    </div>
  );
}

/** 最近操作（审计日志） */
function AuditSection() {
  const [rows, setRows] = useState<
    | Array<{
        id: number;
        at: string;
        actor: string;
        table_name: string;
        record_id: string;
        action: string;
      }>
    | null
  >(null);

  useEffect(() => {
    adminFetch("/api/admin/audit?limit=50", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("加载失败"); return r.json(); })
      .then((d: unknown) => {
        setRows(Array.isArray(d) ? (d as typeof rows) : []);
      })
      .catch(() => setRows([]));
  }, []);

  const actionLabel: Record<string, string> = {
    create: "新增",
    update: "修改",
    delete: "删除",
  };

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm text-foreground-muted">
        最近操作（审计日志）
      </h2>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-border">
              {["时间", "操作者", "表", "记录", "动作"].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-4 py-2.5 text-sm text-foreground-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-base text-foreground-muted"
                >
                  加载中…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-base text-foreground-muted"
                >
                  暂无操作记录
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="num whitespace-nowrap px-4 py-2 text-sm text-foreground-muted">
                    {r.at.replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-4 py-2 text-sm text-foreground-secondary">
                    {r.actor}
                  </td>
                  <td className="px-4 py-2 text-sm text-foreground">
                    {r.table_name}
                  </td>
                  <td className="px-4 py-2 text-sm text-foreground-muted">
                    {r.record_id}
                  </td>
                  <td className="px-4 py-2 text-sm text-foreground-secondary">
                    {actionLabel[r.action] ?? r.action}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatCell(value: unknown, field: FieldDef): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join("、");
  return String(value) || "—";
}

function FormModal({
  def,
  initial,
  deptOptions,
  onClose,
  onSave,
}: {
  def: TableDef;
  initial: Row;
  deptOptions: string[];
  onClose: () => void;
  onSave: (values: Row) => Promise<void>;
}) {
  const isEdit = Object.keys(initial).length > 0;
  const [values, setValues] = useState<Row>(() => {
    const v: Row = {};
    for (const f of def.fields) {
      const cur = initial[f.key];
      v[f.key] = Array.isArray(cur) ? cur.join(",") : (cur ?? "");
    }
    return v;
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try { await onSave(values); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="panel w-full max-w-lg p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-foreground">
            {isEdit ? `编辑${def.label}` : `新增${def.label}`}
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-foreground-muted hover:bg-surface-3 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {def.fields.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-sm text-foreground-muted">
                {f.label}
                {f.required && <span className="text-danger"> *</span>}
              </span>
              {f.key === "has_certificate" ? <select
                value={String(values[f.key] || "0")}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: Number(e.target.value) }))}
                className="h-11 w-full rounded-md border border-border bg-surface-3 px-3 text-base text-foreground outline-none focus:border-primary/50"
              ><option value="0">无</option><option value="1">有</option></select> : f.type === "select" ? (
                <select
                  value={String(values[f.key] ?? "")}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  className="h-11 w-full rounded-md border border-border bg-surface-3 px-3 text-base text-foreground outline-none focus:border-primary/50"
                >
                  <option value="">请选择</option>
                  {(f.key === "dept" && deptOptions.length > 0
                    ? deptOptions
                    : f.options
                  )?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                f.type === "textarea" ? <textarea
                  value={String(values[f.key] ?? "")}
                  placeholder={f.placeholder}
                  required={f.required}
                  maxLength={f.maxLength}
                  rows={f.key === "body" ? 10 : 5}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="w-full resize-y rounded-md border border-border bg-surface-3 px-3 py-3 text-base leading-relaxed text-foreground outline-none placeholder:text-foreground-muted focus:border-primary/50"
                /> :
                <input
                  type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"}
                  required={f.required}
                  maxLength={f.maxLength}
                  min={f.type === "number" ? f.min ?? 0 : undefined}
                  max={f.type === "number" ? f.max ?? 1000000 : undefined}
                  step={f.type === "number" ? f.step ?? 1 : undefined}
                  value={String(values[f.key] ?? "")}
                  placeholder={f.placeholder}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [f.key]:
                        f.type === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-md border border-border bg-surface-3 px-3 text-base text-foreground outline-none placeholder:text-foreground-muted focus:border-primary/50"
                />
              )}
            </label>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-2 text-base text-foreground-secondary hover:text-foreground"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-base font-medium text-background hover:bg-primary-hover disabled:opacity-60"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

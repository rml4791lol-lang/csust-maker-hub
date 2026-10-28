import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowUpRight, Paperclip } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MarkdownContent } from "@/components/markdown-content";
import { getPublicRecord } from "@/lib/public-records";
import { CONTENT_MODULES, recordTitle, valueLabel, type ContentModule } from "@/lib/content-modules";
import type { ReactNode } from "react";

type RecordData = Record<string, unknown>;
const text = (record: RecordData, key: string, fallback = "待补充") => String(record[key] ?? "").trim() || fallback;
const list = (record: RecordData, key: string): string[] => Array.isArray(record[key]) ? record[key].filter((v): v is string => typeof v === "string") : [];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="detail-section"><h2 className="mb-5 text-xl font-semibold">{title}</h2>{children}</section>;
}

function People({ names }: { names: string[] }) {
  return names.length ? <ul className="grid gap-x-8 sm:grid-cols-2">{names.map((name, i) => <li key={`${name}-${i}`} className="border-b border-border py-4 text-lg">{name}</li>)}</ul> : <p className="detail-empty">尚未登记成员。</p>;
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return <aside className="detail-facts"><h2 className="mb-2 text-xl font-semibold">基本信息</h2><dl className="divide-y divide-border">{rows.map(([label, value]) => <div key={label} className="py-4"><dt className="text-sm text-foreground-secondary">{label}</dt><dd className="mt-1.5 break-words text-base leading-relaxed">{value}</dd></div>)}</dl></aside>;
}

function Narrative({ value, empty }: { value: string; empty: string }) {
  return value ? <div className="detail-prose whitespace-pre-wrap break-words">{value}</div> : <p className="detail-empty">{empty}</p>;
}

function detailContent(module: ContentModule, r: RecordData): { lead?: string; body: ReactNode; facts: [string, ReactNode][] } {
  switch (module) {
    case "projects": {
      const stages = ["立项", "开发中", "答辩准备", "已结项", "孵化中"];
      return { facts: [["负责人", text(r, "owner")], ["当前阶段", text(r, "status")], ["更新日期", text(r, "updated")]], body: <>
        <Section title="项目阶段"><ol aria-label="项目阶段" className="flex flex-wrap gap-x-6 gap-y-3 border-b border-border">{stages.map(stage => <li key={stage} aria-current={stage === r.status ? "step" : undefined} className={stage === r.status ? "border-b-2 border-primary pb-3 text-base font-medium text-foreground" : "pb-3 text-base text-foreground-secondary"}>{stage}</li>)}</ol></Section>
        <Section title="项目说明"><Narrative value={text(r, "description", "")} empty="尚未填写项目说明。" /></Section>
      </> };
    }
    case "library": {
      const source = text(r, "source_url", "");
      return { lead: text(r, "summary", ""), facts: [["作者", text(r, "author")], ["类型", valueLabel(r.type)], ["主题", valueLabel(r.topic)], ["状态", text(r, "status")], ["更新日期", text(r, "updated")]], body: <>
        <Section title="正文"><Narrative value={text(r, "body", "")} empty={source ? "尚未补充正文，可通过下方来源链接查看原文。" : "此条目目前仅有摘要，正文尚未补充。"} /></Section>
        {source && <Section title="来源"><a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-start gap-2 text-base text-primary underline underline-offset-4"><span className="break-all">{source}</span><ArrowUpRight aria-hidden className="mt-1 size-4 shrink-0" /></a></Section>}
        {list(r, "tags").length > 0 && <Section title="标签"><p className="text-base leading-8 text-foreground-secondary">{list(r, "tags").join(" / ")}</p></Section>}
      </> };
    }
    case "members": return { lead: [text(r, "dept", ""), text(r, "role", "")].filter(Boolean).join(" · "), facts: [["部门", text(r, "dept")], ["角色", text(r, "role")], ["年级", text(r, "grade")]], body: <Section title="技能与方向">{list(r, "skills").length ? <ul className="divide-y divide-border">{list(r, "skills").map(skill => <li key={skill} className="py-4 text-lg">{skill}</li>)}</ul> : <p className="detail-empty">尚未登记技能。</p>}</Section> };
    case "competitions": return { lead: text(r, "host", ""), facts: [["赛事级别", text(r, "level")], ["主办方", text(r, "host")], ["状态", text(r, "status")], ["截止日期", text(r, "deadline", "待公布")], ["已登记队伍", `${Number(r.teams) || 0} 支`]], body: <>
      <Section title="参赛成员"><People names={list(r, "members")} /></Section>
      <Section title="赛事信息"><p className="detail-prose">目前记录包含主办方、截止日期与参赛成员，详细规则和报名入口尚未收录。</p>{!/^\d{4}-/.test(text(r, "deadline", "")) && <p className="mt-4 text-base text-foreground-secondary">截止日期未标注年份，参赛前请向主办方核实。</p>}</Section>
    </> };
    case "activities": return { facts: [["活动类型", valueLabel(r.kind)], ["状态", text(r, "status")], ["已登记人数", `${Number(r.joined) || 0} 人`], ["名额", Number(r.capacity) > 0 ? `${r.capacity} 人` : "未设置"]], body: <>
      <Section title="活动安排"><dl className="divide-y divide-border"><div className="py-5"><dt className="text-sm text-foreground-secondary">时间</dt><dd className="mt-2 text-2xl font-medium">{text(r, "date", "待公布")}</dd></div><div className="py-5"><dt className="text-sm text-foreground-secondary">地点</dt><dd className="mt-2 break-words text-xl">{text(r, "place", "待公布")}</dd></div></dl>{!/^\d{4}-/.test(text(r, "date", "")) && <p className="mt-5 text-base text-foreground-secondary">时间尚未标注年份，参加前请核实安排。</p>}</Section>
      <Section title="参加活动"><p className="detail-prose">人数为管理员登记结果。线上报名尚未开放。</p></Section>
    </> };
    case "achievements": return { lead: text(r, "competition", ""), facts: [["获奖级别", text(r, "level")], ["所属赛事", text(r, "competition")], ["获奖日期", text(r, "date")], ["证书记录", Number(r.has_certificate) === 1 ? "已登记有证书" : "待补证书"]], body: <>
      <Section title="获奖成员"><People names={list(r, "members")} /></Section>
      <Section title="证明材料"><p className="detail-empty">尚未提供可查看的证书文件。</p></Section>
    </> };
    case "footprints": {
      const attachment = text(r, "attachment_path", "");
      return { facts: [["记录人", text(r, "member")], ["部门", text(r, "author_dept")], ["记录日期", text(r, "date")], ["关联项目", text(r, "project", "未关联")], ["投入时间", `${Number(r.hours) || 0} 小时`]], body: <>
        <Section title="完成记录"><Narrative value={text(r, "content", "")} empty="尚未填写内容。" /></Section>
        {attachment && <Section title="附件"><a href={`/api/uploads/${encodeURIComponent(attachment)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 max-w-full items-center gap-3 rounded-md border border-border px-4 py-3 text-base text-primary hover:border-border-strong"><Paperclip className="size-5 shrink-0" /><span className="break-all">{text(r, "attachment_name", "查看附件")}</span><ArrowUpRight className="size-4 shrink-0" /></a></Section>}
      </> };
    }
  }
}

export async function RecordDetail({ module, id }: { module: ContentModule; id: string }) {
  await connection();
  const record = getPublicRecord(module, id);
  if (!record) notFound();
  const title = recordTitle(module, record);
  if (module === "library") return <div className="article-shell">
    <nav aria-label="面包屑" className="detail-breadcrumb"><Link href="/library" className="inline-flex min-h-11 items-center gap-2"><ArrowLeft size={17} />返回社区</Link></nav>
    <article><header className="article-heading"><div className="article-meta"><span>{valueLabel(record.type)}</span><span>{text(record, "author")}</span><span>{text(record, "updated")}</span></div><h1>{title}</h1>{text(record, "summary", "") && <p>{text(record, "summary", "")}</p>}</header>
    {text(record, "body", "") ? <MarkdownContent body={text(record, "body", "")} format={record.body_format === "markdown" ? "markdown" : "plain"} /> : <p className="detail-empty">正文尚未补充。</p>}
    {text(record, "source_url", "") && <div className="article-source"><h2>原文与参考</h2><a href={text(record, "source_url", "")} target="_blank" rel="noopener noreferrer">{text(record, "source_url", "")}<ArrowUpRight size={18} /></a></div>}
    {list(record, "tags").length > 0 && <p className="article-tags">{list(record, "tags").join(" / ")}</p>}</article>
  </div>;
  const content = detailContent(module, record);
  return <div className="detail-shell">
    <nav aria-label="面包屑" className="detail-breadcrumb"><Link href={`/${module}`} className="inline-flex min-h-11 items-center gap-2 hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />{CONTENT_MODULES[module].label}</Link><span aria-hidden>/</span><span aria-current="page" className="min-w-0 truncate">{title}</span></nav>
    <PageHeader title={title} description={content.lead} />
    <div className={`detail-layout${["library", "activities", "footprints"].includes(module) ? " detail-reading" : ""}`}><article className="min-w-0">{content.body}</article><Facts rows={content.facts} /></div>
  </div>;
}

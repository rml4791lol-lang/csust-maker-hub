"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { PageHeader, FilterChip, EmptyState } from "@/components/page-header";
import { contentTypes, topics } from "@/lib/mock-data";
import type { ItemRow } from "@/lib/queries";
import { recordHref } from "@/lib/content-modules";
export default function LibraryPage() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [type, setType] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/items", { cache: "no-store", signal: abort.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false); }).catch(() => { if (!abort.signal.aborted) { setError(true); setLoading(false); } });
    return () => abort.abort();
  }, [attempt]);
  const query = q.trim().toLowerCase();
  const filtered = items.filter(i => (!type || i.type === type) && (!topic || i.topic === topic) && (!query || [i.title, i.summary, ...i.tags].some(s => s.toLowerCase().includes(query))));
  return <div className="official-page community-page"><PageHeader title="社区" description="分享工具与方法，记录探索与实践。" />
    <div className="community-layout"><aside className="community-filters"><div className="community-mobile-filters"><label>内容分类<select value={type || ""} onChange={e => setType(e.target.value || null)}><option value="">全部内容</option>{contentTypes.map(ct => <option key={ct.key} value={ct.key}>{ct.label}</option>)}</select></label><label>探索主题<select value={topic || ""} onChange={e => setTopic(e.target.value || null)}><option value="">全部主题</option>{topics.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label></div><h2>内容分类</h2><div className="community-types"><button aria-pressed={!type} onClick={() => setType(null)}>全部内容<span>{items.length}</span></button>{contentTypes.map(ct => <button key={ct.key} aria-pressed={type === ct.key} onClick={() => setType(type === ct.key ? null : ct.key)}>{ct.label}<span>{items.filter(i => i.type === ct.key).length}</span></button>)}</div><div className="community-topic"><h2>探索主题</h2><div className="flex flex-wrap gap-2"><FilterChip label="全部" active={!topic} onClick={() => setTopic(null)} />{topics.map(t => <FilterChip key={t.key} label={t.label} active={topic === t.key} onClick={() => setTopic(topic === t.key ? null : t.key)} />)}</div></div></aside>
    <section className="min-w-0" aria-label="社区文章"><div className="community-search"><div><Search size={19} aria-hidden /><input aria-label="搜索内容" value={q} onChange={e => setQ(e.target.value)} placeholder="搜索标题、摘要或标签" /></div><span aria-live="polite">{loading ? "正在读取" : `${filtered.length} 篇内容`}</span></div>
      {error ? <div role="alert" className="py-12"><p>暂时无法加载社区内容。</p><button className="text-link mt-4" onClick={() => { setError(false); setLoading(true); setAttempt(v => v+1); }}>重新加载</button></div> : loading ? <p className="py-12 text-base text-foreground-secondary">正在加载内容…</p> : filtered.length === 0 ? <EmptyState text="暂无匹配内容，试试其他分类或关键词。" /> : <ul className="community-feed">{filtered.map(item => <li key={item.id}><div className="article-meta"><span>{contentTypes.find(t => t.key === item.type)?.label || item.type}</span><span>{item.author}</span><span>{item.updated}</span></div><Link className="community-title" href={recordHref("library", item.id)}><h2>{item.title}</h2><ArrowUpRight size={23} aria-hidden /></Link><p>{item.summary}</p>{item.tags.length > 0 && <div className="community-tags">{item.tags.join(" / ")}</div>}</li>)}</ul>}
    </section></div>
  </div>;
}

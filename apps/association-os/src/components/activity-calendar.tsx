"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, List } from "lucide-react";
import { activityDay, shiftDay, weekDays } from "@/lib/calendar";
import type { ActivityRow } from "@/lib/queries";
import { recordHref } from "@/lib/content-modules";
const labels = ["一", "二", "三", "四", "五", "六", "日"];
function Event({ item }: { item: ActivityRow }) {
  return <Link className="calendar-event" href={recordHref("activities", item.id)}><time>{item.date.trim().slice(11) || "时间待定"}</time><h3>{item.title}</h3><p>{item.place || "地点待定"}</p><span>{item.status}</span></Link>;
}
export function ActivityCalendar({ items, today }: { items: ActivityRow[]; today: string }) {
  const [anchor, setAnchor] = useState(today);
  const [mode, setMode] = useState<"week" | "list">("week");
  const days = weekDays(anchor);
  const dated = items.filter(a => activityDay(a.date)).sort((a,b) => a.date.trim().replace("T", " ").localeCompare(b.date.trim().replace("T", " ")));
  const undated = items.filter(a => !activityDay(a.date));
  const weekly = dated.filter(a => days.includes(activityDay(a.date)!));
  return <>
    <section className="calendar-section" aria-label="活动日程">
      <div className="calendar-toolbar"><div><h2>{days[0].replaceAll("-", ".")} — {days[6].slice(5).replace("-", ".")}</h2><p>周一至周日</p></div><div className="calendar-controls"><div className="calendar-step"><button aria-label="上一周" onClick={() => setAnchor(shiftDay(anchor, -7))}><ChevronLeft size={20} /></button><button onClick={() => setAnchor(today)}>本周</button><button aria-label="下一周" onClick={() => setAnchor(shiftDay(anchor, 7))}><ChevronRight size={20} /></button></div><div className="calendar-mode"><button aria-pressed={mode === "week"} onClick={() => setMode("week")}><CalendarDays size={18} />周排程</button><button aria-pressed={mode === "list"} onClick={() => setMode("list")}><List size={18} />全部活动</button></div></div></div>
      {mode === "week" ? <><div className="calendar-grid">{days.map((day, i) => <section key={day} className={day === today ? "calendar-day is-today" : "calendar-day"}><header><span>周{labels[i]}</span><time dateTime={day}>{Number(day.slice(8))}<span>{day.slice(5,7)}月</span></time>{day === today && <strong>今天</strong>}</header><div className="calendar-day-body">{weekly.filter(a => activityDay(a.date) === day).map(item => <Event key={item.id} item={item} />)}</div></section>)}</div>{weekly.length === 0 && <p className="calendar-empty" role="status">这一周暂无已登记活动，可切换周次或查看全部活动。</p>}</> : <div className="event-agenda">{dated.length ? dated.map(item => <div key={item.id}><time dateTime={activityDay(item.date)!}>{activityDay(item.date)}</time><Event item={item} /></div>) : <p className="calendar-empty">暂无日期完整的活动记录。</p>}</div>}
    </section>
    {undated.length > 0 && <section className="undated-events"><h2>日期待完善</h2><p>以下记录缺少完整日期，暂未编入排程。</p><ul>{undated.map(item => <li key={item.id}><span>{item.date || "日期待定"}</span><Link href={recordHref("activities", item.id)}>{item.title}</Link><span>{item.place}</span><span>{item.status}</span></li>)}</ul></section>}
  </>;
}

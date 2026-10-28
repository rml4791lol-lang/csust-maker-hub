import { connection } from "next/server";
import Image from "next/image";
import { PageHeader } from "@/components/page-header";
import { ActivityCalendar } from "@/components/activity-calendar";
import { listActivities } from "@/lib/queries";
import { shanghaiToday } from "@/lib/calendar";
export const instant = false;
export default async function ActivitiesPage() {
  await connection();
  const activities = listActivities().map(item => ({ ...item }));
  return <div className="official-page"><PageHeader title="活动" description="在分享、交流与实践中，让想法继续生长。" /><ActivityCalendar items={activities} today={shanghaiToday()} /><section className="activity-scenes"><div className="section-heading"><h2>现场记录</h2><p>分享、讨论，和共同动手的时刻。</p></div><div>{[["sharing", "技术分享", "成员在投影屏幕前进行技术分享"], ["discussion", "围坐交流", "成员在会议桌旁共同交流讨论"]].map(([file, title, alt]) => <figure key={file}><Image src={`/images/association/${file}.webp`} alt={alt} width={1706} height={1279} sizes="(max-width: 720px) 100vw, 50vw" /><figcaption>{title}</figcaption></figure>)}</div></section></div>;
}

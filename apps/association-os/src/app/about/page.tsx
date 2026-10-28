import { connection } from "next/server";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { getMeta } from "@/lib/db";
import { listDepartments } from "@/lib/queries";
import { GeometryMark } from "@/components/geometry-mark";
export const instant = false;
export default async function AboutPage() {
  await connection();
  const departments = listDepartments();
  const sampleData = getMeta().data_source === "seed";
  return <div className="official-page about-page">
    <section className="about-opening">
      <div className="about-intro"><GeometryMark aria-hidden className="about-geometry" /><h1>让想法相遇，<br />让创造发生。</h1><p className="about-name">长沙理工大学 AI 创客协会</p><p>把 AI 工具、开发技能与实践经验连接起来，从一个想法出发，在交流与协作中，做出自己的作品。</p><Link href="/projects" className="text-link">看看我们在做什么<ArrowUpRight size={20} /></Link></div>
      <figure className="about-main-photo"><Image src="/images/association/gathering.webp" alt="协会成员在交流活动中合影" width={1706} height={1279} priority sizes="(max-width: 800px) 100vw, 55vw" /><figcaption>在交流中相识，在实践中同行。</figcaption></figure>
    </section>
    <section className="about-practice"><div><h2>从学习到实践</h2><p>把一次分享变成可复用的经验，把一次尝试推进成可以展示的作品。</p></div><div className="practice-links">{[["学习与分享", "阅读技术文章，交流工具与方法，让经验留在社区。", "/library"], ["项目与协作", "围绕具体问题动手开发，持续记录过程与进展。", "/projects"], ["活动与交流", "通过讲解、讨论和共同实践，发现下一步的方向。", "/activities"]].map(([title, body, href]) => <Link key={href} href={href}><div><h3>{title}</h3><p>{body}</p></div><ArrowUpRight size={22} aria-hidden /></Link>)}</div></section>
    <section className="about-scenes"><figure><Image src="/images/association/innovation-building.webp" alt="科创港建筑与周边校园环境" width={1200} height={785} sizes="(max-width: 800px) 100vw, 60vw" /><figcaption>科创港一景</figcaption></figure><figure><Image src="/images/association/lecture.webp" alt="成员在投影屏幕前讲解，其他成员围坐聆听" width={1706} height={1279} sizes="(max-width: 800px) 100vw, 40vw" /><figcaption>面对面的分享与交流</figcaption></figure></section>
    <section className="about-organization"><div className="section-heading"><h2>在这里，共同协作</h2><Link href="/members" className="text-link">查看成员<ArrowUpRight size={19} /></Link></div>{sampleData && <p className="mb-6 text-base text-foreground-secondary">以下为待核验的部门示例，正式组织信息确认后更新。</p>}<div className="department-roster">{departments.map(d => <div key={d.name}><h3>{d.name}</h3>{!sampleData && <p>负责人 · {d.lead || "待确认"}</p>}</div>)}</div></section>
    <section className="about-contact"><h2>保持交流</h2><p>协会联系方式与值班安排将在确认后公布。你可以先从社区文章、活动安排与项目记录了解我们。</p><div className="flex flex-wrap gap-6"><Link href="/library" className="text-link">进入社区<ArrowUpRight size={20} /></Link><Link href="/activities" className="text-link">查看活动<ArrowUpRight size={20} /></Link></div></section>
  </div>;
}

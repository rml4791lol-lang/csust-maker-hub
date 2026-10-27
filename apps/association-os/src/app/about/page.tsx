import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { listDepartments, listMembers } from "@/lib/queries";

export const instant = false;

export default async function AboutPage() {
  await connection();
  const departments = listDepartments();
  const members = listMembers();
  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-8 md:px-8">
      <PageHeader title="关于" />

      {/* 社刊封面 */}
      <section className="relative overflow-hidden panel p-6 lg:p-12">
        {/* 超大标题 */}
        <h2 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.03em] text-foreground">
          AI 创客
          <br />
          <span className="text-foreground-muted">协会</span>
        </h2>
        <div className="mt-5 text-base text-foreground-secondary">
          长沙理工大学
        </div>

        {/* 正文（首字下沉） */}
        <div className="mt-10 max-w-2xl">
          <p className="prose-cn drop-cap text-foreground-secondary">
            长沙理工大学 AI
            创客协会是一个面向全校学生的技术与实践组织。我们把 AI
            工具、开发技能和竞赛经验沉淀成可复用的内容，让每个成员都能从「有一个想法」走到「做出一个东西」。
          </p>
          <p className="prose-cn mt-4 text-foreground-secondary">
            平台已登记 {members.length} 名成员、{departments.length} 个部门。
          </p>
        </div>

        {/* 数字 */}
        <div className="mt-10 grid grid-cols-2 gap-6 border-t border-border pt-6">
          {[
            { v: String(members.length), k: "在册成员" },
            { v: String(departments.length), k: "部门" },
          ].map((s) => (
            <div key={s.k}>
              <div className="num text-[40px] leading-none text-foreground">
                {s.v}
              </div>
              <div className="mt-3 text-base text-foreground-secondary">
                {s.k}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 部门 */}
      <section className="mt-8">
        <h3 className="mb-4 text-xl font-semibold text-foreground">
          部门
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {departments.map((d) => (
            <div
              key={d.name}
              className="panel px-5 py-4"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-semibold text-foreground">
                  {d.name}
                </span>
                <span className="num text-[20px] leading-none text-foreground-muted">
                  {d.active}
                </span>
              </div>
              <div className="mt-3 text-sm leading-relaxed text-foreground-secondary">
                负责人 {d.lead} · 累计公开足迹 {d.contributions}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 border-t border-border pt-6">
        <h3 className="text-xl font-semibold">联系协会</h3>
        <p className="mt-3 text-base text-foreground-secondary">联系方式与值班安排待协会确认后公布。</p>
      </section>
    </div>
  );
}

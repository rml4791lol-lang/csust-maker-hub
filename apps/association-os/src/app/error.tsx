"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <div className="detail-shell py-16"><h1 className="text-3xl font-semibold">暂时无法加载内容</h1><p role="alert" className="mt-4 text-base text-foreground-secondary">请重试，或返回首页继续浏览。</p><div className="mt-8 flex flex-wrap gap-3"><button onClick={reset} className="min-h-12 rounded-md bg-foreground px-5 text-base text-background">重新加载</button><Link href="/" className="inline-flex min-h-12 items-center rounded-md border border-border px-5 text-base">返回首页</Link></div></div>;
}

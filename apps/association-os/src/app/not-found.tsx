import Link from "next/link";
import { ArrowLeft } from "lucide-react";
export default function NotFound() {
  return <div className="detail-shell py-16"><h1 className="text-3xl font-semibold">内容暂不可用</h1><p className="mt-4 max-w-xl text-base leading-relaxed text-foreground-secondary">这条内容可能已移除或尚未公开。</p><Link href="/" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-md border border-border px-5 text-base hover:border-border-strong"><ArrowLeft className="size-4" />返回首页</Link></div>;
}

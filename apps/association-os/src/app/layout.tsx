import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/noto-sans-sc";
import "@fontsource-variable/noto-serif-sc";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import "./official.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "AI 创客协会 · 长理创客站",
  robots: { index: false, follow: false },
  description: "AI 创客协会的技术分享、项目实践与活动记录。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

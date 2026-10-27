import { connection } from "next/server";
import { Dashboard } from "@/components/dashboard";

/** 首页数据来自数据库 + 当前日期，必须动态渲染 */
export const instant = false;

export default async function Home() {
  await connection();
  return <Dashboard />;
}

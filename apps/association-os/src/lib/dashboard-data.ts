import {
  getProjectStatusFlow, getStats, listActivities, listCompetitions,
  listContributions, listDepartments, listItems, listProjects,
} from "./queries";
import { getMeta } from "./db";
import type { StatusTone } from "@/components/ui/status-tag";

/** Public homepage: cumulative counts only; legacy dates do not include a year. */
export function getDashboardData() {
  const stats = getStats();
  const projects = listProjects();
  const contributions = listContributions().filter((c) => c.status === "approved");
  const items = listItems();
  const statusToneMap: Record<string, StatusTone> = {
    立项: "neutral", 开发中: "info", 答辩准备: "warning",
    已结项: "success", 孵化中: "primary",
  };
  const activeProjectCount = projects.filter(
    (p) => p.status === "开发中" || p.status === "答辩准备",
  ).length;
  const meta = getMeta();
  return {
    dataSource: meta.data_source === "seed"
      ? "示例数据 · 待核验"
      : "录入数据 · 待核验",
    metrics: [
      { label: "在册成员", value: stats.members, href: "/members", note: "当前成员档案" },
      { label: "进行中项目", value: activeProjectCount, href: "/projects", note: "开发中 / 答辩准备" },
      { label: "内容库", value: items.length, href: "/library", note: "已收录内容" },
      { label: "公开足迹", value: contributions.length, href: "/footprints", note: "累计公开记录" },
    ],
    activeProjectCount,
    projects: projects.map((p) => ({ ...p, tone: statusToneMap[p.status] ?? "neutral" })),
    statusFlow: getProjectStatusFlow().map((s) => ({
      ...s, tone: statusToneMap[s.label] ?? "neutral",
    })),
    footprints: contributions.slice(0, 4),
    footprintCount: contributions.length,
    departments: listDepartments(),
    resources: items.slice(0, 3),
    contentTypeCounts: (type: string) => items.filter((i) => i.type === type).length,
    events: listActivities().slice(0, 3),
    competitions: listCompetitions().slice(0, 3),
  };
}

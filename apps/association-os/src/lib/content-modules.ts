/** Presentation metadata only. Authorization and public visibility live on the server. */
export const CONTENT_MODULES = {
  projects: { label: "项目", table: "projects", titleKey: "name", section: "项目说明" },
  library: { label: "内容库", table: "items", titleKey: "title", section: "正文" },
  members: { label: "成员", table: "members", titleKey: "name", section: "技能与方向" },
  competitions: { label: "竞赛", table: "competitions", titleKey: "name", section: "参赛成员" },
  activities: { label: "活动", table: "activities", titleKey: "title", section: "活动安排" },
  achievements: { label: "成果", table: "awards", titleKey: "title", section: "获奖成员" },
  footprints: { label: "足迹", table: "contributions", titleKey: "member", section: "完成记录" },
} as const;

export type ContentModule = keyof typeof CONTENT_MODULES;

export function entityLabel(module: ContentModule) {
  return module === "library" ? "内容" : CONTENT_MODULES[module].label;
}

export function recordHref(module: ContentModule, id: string) {
  return `/${module}/${encodeURIComponent(id)}`;
}

const labels: Record<string, string> = {
  guide: "攻略", skill: "技能指令", template: "模板素材", link: "外部资源",
  training: "培训", ai: "人工智能", web: "Web 开发", hardware: "硬件",
  visual: "视觉设计", startup: "创新创业", meeting: "会议", sharing: "分享",
  activity: "活动", draft: "草稿", pending: "待审核", approved: "已公开",
};

export function valueLabel(value: unknown): string {
  const text = String(value ?? "");
  return labels[text] ?? text;
}

export function recordTitle(module: ContentModule, record: Record<string, unknown>) {
  const title = String(record[CONTENT_MODULES[module].titleKey] || "未命名");
  return module === "footprints" ? `${title}的足迹` : title;
}

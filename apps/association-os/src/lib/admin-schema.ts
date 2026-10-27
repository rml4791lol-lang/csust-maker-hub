// ============================================================
// 管理后台数据模型定义（API 与表单共用）
// 说明：当前数据库中为示例数据，可通过 /admin 自行增删改为真实数据。
// ============================================================

export type FieldType = "text" | "number" | "select" | "tags" | "date";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface TableDef {
  /** 路由名（/admin/<key>） */
  key: string;
  /** 中文名 */
  label: string;
  /** 主键列 */
  pk: string;
  /** 自增编号前缀（新建时生成） */
  idPrefix?: string;
  fields: FieldDef[];
  /** 需要 JSON 序列化的列 */
  jsonFields: string[];
}

export const TABLE_DEFS: Record<string, TableDef> = {
  members: {
    key: "members",
    label: "成员",
    pk: "id",
    idPrefix: "m",
    jsonFields: ["skills"],
    fields: [
      { key: "name", label: "姓名", type: "text", required: true },
      {
        key: "dept",
        label: "部门",
        type: "select",
        required: true,
        options: ["技术部", "竞赛部", "宣传部", "创新创业部"],
      },
      { key: "role", label: "角色", type: "text", placeholder: "如：部长 / 课程负责人" },
      { key: "grade", label: "年级", type: "text", placeholder: "如：2024 级" },
      { key: "skills", label: "技能", type: "tags", placeholder: "逗号分隔，如：前端,Astro" },
    ],
  },

  items: {
    key: "items",
    label: "内容",
    pk: "id",
    idPrefix: "i",
    jsonFields: ["tags"],
    fields: [
      { key: "title", label: "标题", type: "text", required: true },
      {
        key: "type",
        label: "类型",
        type: "select",
        required: true,
        options: ["guide", "skill", "template", "link", "training"],
      },
      {
        key: "topic",
        label: "主题",
        type: "select",
        required: true,
        options: ["ai", "web", "hardware", "visual", "startup"],
      },
      { key: "author", label: "作者", type: "text", required: true },
      { key: "summary", label: "摘要", type: "text", required: true },
      { key: "tags", label: "标签", type: "tags", placeholder: "逗号分隔" },
      { key: "status", label: "状态", type: "text", placeholder: "如：已发布" },
      { key: "updated", label: "更新日期", type: "text", placeholder: "如：10-27" },
    ],
  },

  projects: {
    key: "projects",
    label: "项目",
    pk: "name",
    jsonFields: [],
    fields: [
      { key: "name", label: "项目名", type: "text", required: true },
      { key: "owner", label: "负责人", type: "text", required: true },
      {
        key: "status",
        label: "状态",
        type: "select",
        required: true,
        options: ["立项", "开发中", "答辩准备", "已结项", "孵化中"],
      },
      { key: "updated", label: "更新", type: "text", placeholder: "如：10-27" },
    ],
  },

  competitions: {
    key: "competitions",
    label: "竞赛",
    pk: "id",
    idPrefix: "k",
    jsonFields: ["members"],
    fields: [
      { key: "name", label: "赛事名", type: "text", required: true },
      {
        key: "level",
        label: "级别",
        type: "select",
        options: ["国家级", "省级", "校级"],
      },
      { key: "host", label: "主办方", type: "text" },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: ["报名中", "备赛中", "待核验", "已结束"],
      },
      { key: "deadline", label: "截止", type: "text", placeholder: "MM-DD" },
      { key: "teams", label: "队伍数", type: "number" },
      { key: "members", label: "参赛成员", type: "tags", placeholder: "逗号分隔" },
    ],
  },

  activities: {
    key: "activities",
    label: "活动",
    pk: "id",
    idPrefix: "a",
    jsonFields: [],
    fields: [
      { key: "title", label: "标题", type: "text", required: true },
      {
        key: "kind",
        label: "类型",
        type: "select",
        options: ["training", "meeting", "sharing", "activity"],
      },
      { key: "date", label: "时间", type: "text", placeholder: "如：10-29 19:00" },
      { key: "place", label: "地点", type: "text" },
      { key: "status", label: "状态", type: "text", placeholder: "如：报名中" },
      { key: "joined", label: "已报名", type: "number" },
      { key: "capacity", label: "名额", type: "number" },
    ],
  },

  awards: {
    key: "awards",
    label: "成果",
    pk: "id",
    idPrefix: "aw",
    jsonFields: ["members"],
    fields: [
      { key: "title", label: "奖项", type: "text", required: true },
      {
        key: "level",
        label: "级别",
        type: "select",
        options: ["国家级", "省级", "校级"],
      },
      { key: "competition", label: "所属赛事", type: "text" },
      { key: "members", label: "获奖成员", type: "tags", placeholder: "逗号分隔" },
      { key: "date", label: "日期", type: "text", placeholder: "MM-DD" },
      { key: "has_certificate", label: "有证书", type: "number", placeholder: "1=有 0=无" },
    ],
  },

  contributions: {
    key: "contributions",
    label: "足迹",
    pk: "id",
    idPrefix: "c",
    jsonFields: [],
    fields: [
      { key: "member", label: "成员", type: "text", required: true },
      { key: "content", label: "做了什么", type: "text", required: true },
      { key: "project", label: "关联项目", type: "text" },
      { key: "hours", label: "耗时(h)", type: "number" },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: ["draft", "pending", "approved"],
      },
      { key: "date", label: "日期", type: "text", placeholder: "MM-DD" },
    ],
  },
};

export const TABLE_KEYS = Object.keys(TABLE_DEFS);

/** 解码一行：JSON 列反序列化 */
export function decodeRow(
  row: Record<string, unknown>,
  def: TableDef,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const f of def.jsonFields) {
    try {
      out[f] = JSON.parse(String(row[f] ?? "[]"));
    } catch {
      out[f] = [];
    }
  }
  return out;
}

/** 编码一行：JSON 列序列化 */
export function encodeValue(value: unknown, field: FieldDef): unknown {
  if (field.type === "tags") {
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === "string") {
      return JSON.stringify(
        value
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
    return "[]";
  }
  if (field.type === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    // 不允许负数（工时/人数/队伍数等均为非负）
    return Math.max(0, Math.floor(n));
  }
  return value ?? null;
}

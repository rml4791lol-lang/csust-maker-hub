// ============================================================
// 管理后台数据模型定义（API 与表单共用）
// 说明：当前数据库中为示例数据，可通过 /admin 自行增删改为真实数据。
// ============================================================

export type FieldType = "text" | "textarea" | "url" | "number" | "select" | "tags" | "date";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface TableDef {
  /** 路由名（/admin/<key>） */
  key: string;
  /** 中文名 */
  label: string;
  /** 主键列 */
  pk: string;
  /** Stable public URL key when the legacy primary key can be renamed. */
  stableKey?: string;
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
      { key: "summary", label: "摘要", type: "textarea", required: true, maxLength: 2000 },
      { key: "body", label: "正文", type: "textarea", maxLength: 50000 },
      { key: "body_format", label: "正文格式", type: "select", options: ["plain", "markdown"] },
      { key: "source_url", label: "来源链接", type: "url", maxLength: 2048, placeholder: "https://" },
      { key: "tags", label: "标签", type: "tags", placeholder: "逗号分隔" },
      { key: "status", label: "状态", type: "select", options: ["草稿", "待审核", "已发布", "已收录", "报名中", "已归档"] },
      { key: "updated", label: "更新日期", type: "text", placeholder: "如：10-27" },
    ],
  },

  projects: {
    key: "projects",
    label: "项目",
    pk: "name",
    stableKey: "id",
    idPrefix: "p",
    jsonFields: [],
    fields: [
      { key: "name", label: "项目名", type: "text", required: true },
      { key: "owner", label: "负责人", type: "text", required: true },
      { key: "description", label: "项目说明", type: "textarea", maxLength: 20000 },
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
      { key: "has_certificate", label: "有证书", type: "number", min: 0, max: 1, placeholder: "1=有 0=无" },
    ],
  },

  contributions: {
    key: "contributions",
    label: "足迹",
    pk: "id",
    idPrefix: "c",
    jsonFields: [],
    fields: [
      { key: "member", label: "成员", type: "text", required: true, maxLength: 20 },
      { key: "content", label: "做了什么", type: "textarea", required: true, maxLength: 500 },
      { key: "project", label: "关联项目", type: "text", maxLength: 200 },
      { key: "hours", label: "耗时(h)", type: "number", min: 0, max: 24, step: 0.1 },
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

export function getTableDef(key: string): TableDef | undefined {
  return Object.hasOwn(TABLE_DEFS, key) ? TABLE_DEFS[key] : undefined;
}

/** Validate editable fields before encoding; unknown keys are never written. */
export function validateFields(body: Record<string, unknown>, def: TableDef, partial = false): string | null {
  for (const field of def.fields) {
    const value = body[field.key];
    if (partial && value === undefined) continue;
    if (field.required && (value == null || typeof value === "string" && !value.trim())) return `${field.label} 为必填`;
    if (value == null) continue;
    if (field.type === "number") {
      if (typeof value !== "number" && typeof value !== "string") return `${field.label} 必须是数字`;
      const n = Number(value);
      if (!Number.isFinite(n) || n < (field.min ?? 0) || n > (field.max ?? 1000000)) return `${field.label} 超出允许范围`;
      if ((field.step ?? 1) === 1 && !Number.isInteger(n)) return `${field.label} 必须是整数`;
      continue;
    }
    if (field.type === "tags") {
      const tags = typeof value === "string" ? value.split(/[,，]/) : value;
      if (!Array.isArray(tags) || tags.length > 100 || tags.some(v => typeof v !== "string" || v.length > 100)) return `${field.label} 格式不正确`;
      continue;
    }
    if (typeof value !== "string") return `${field.label} 必须是文本`;
    if (value.length > (field.maxLength ?? 200)) return `${field.label} 过长`;
    // Departments are governed by the actual database FK, not this UI hint list.
    if (field.type === "select" && field.key !== "dept" && value && !field.options?.includes(value)) return `${field.label} 选项无效`;
    if (field.type === "url" && value.trim()) {
      try {
        const url = new URL(value.trim());
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return `${field.label} 仅支持 HTTP 或 HTTPS 地址`;
      } catch { return `${field.label} 不是有效网址`; }
    }
  }
  return null;
}

/** 解码一行：JSON 列反序列化 */
export function decodeRow(
  row: Record<string, unknown>,
  def: TableDef,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const f of def.jsonFields) {
    try {
      const value: unknown = JSON.parse(String(row[f] ?? "[]"));
      out[f] = Array.isArray(value) ? value.filter(v => typeof v === "string") : [];
    } catch {
      out[f] = [];
    }
  }
  return out;
}

/** 编码一行：JSON 列序列化 */
export function encodeValue(value: unknown, field: FieldDef): unknown {
  if (field.type === "tags") {
    if (Array.isArray(value)) return JSON.stringify(value.map(v => String(v).trim()).filter(Boolean));
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
    return Math.max(0, (field.step ?? 1) < 1 ? n : Math.floor(n));
  }
  return typeof value === "string" ? value.trim() : "";
}

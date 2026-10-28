import { getDb } from "./db";

/** Public route names are deliberately separate from internal table names. */
export const PUBLIC_MODULES = {
  projects: "projects", library: "items", members: "members",
  competitions: "competitions", activities: "activities",
  achievements: "awards", footprints: "contributions",
} as const;
export type PublicModule = keyof typeof PUBLIC_MODULES;
export type PublicRecord = Record<string, unknown> & { id: string };

// Legacy published entries include collected links, open training and archives.
// Unknown statuses are private by default. Never accept SQL from request input.
export const PUBLIC_ITEM_STATUS_SQL = "status IN ('已发布', '已收录', '报名中', '已归档')";
const projections: Record<PublicModule, string> = {
  projects: "id,name,owner,status,updated,description",
  library: "id,title,type,topic,author,summary,tags,status,updated,body,body_format,source_url",
  members: "id,name,dept,role,grade,skills",
  competitions: "id,name,level,host,status,deadline,teams,members",
  activities: "id,title,kind,date,place,status,joined,capacity",
  achievements: "id,title,level,competition,members,date,has_certificate",
  footprints: "id,member,date,content,project,hours,status,created_at,author_dept,attachment_name,attachment_path,attachment_size,attachment_type",
};

export function isPublicModule(value: string): value is PublicModule {
  return Object.hasOwn(PUBLIC_MODULES, value);
}

function decode(module: PublicModule, row: Record<string, unknown>): PublicRecord {
  const value = { ...row };
  const field = module === "members" ? "skills" : module === "library" ? "tags"
    : module === "competitions" || module === "achievements" ? "members" : null;
  if (field) {
    try {
      const list: unknown = JSON.parse(String(value[field]));
      value[field] = Array.isArray(list) ? list.filter(v => typeof v === "string") : [];
    } catch { value[field] = []; }
  }
  if (module === "library" && value.source_url) {
    try {
      const url = new URL(String(value.source_url));
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) value.source_url = "";
    } catch { value.source_url = ""; }
  }
  return value as PublicRecord;
}

/** Caller gets only the public projection; private/missing entries are identical. */
export function getPublicRecord(module: PublicModule, id: string): PublicRecord | null {
  if (!isPublicModule(module) || !id || id.length > 300) return null;
  const visibility = module === "library" ? ` AND ${PUBLIC_ITEM_STATUS_SQL}`
    : module === "footprints" ? " AND status = 'approved'" : "";
  const row = getDb().prepare(
    `SELECT ${projections[module]} FROM ${PUBLIC_MODULES[module]} WHERE id = ?${visibility}`,
  ).get(id) as Record<string, unknown> | undefined;
  return row ? decode(module, row) : null;
}

export function listPublicItems(filters: { type?: string | null; topic?: string | null; q?: string | null } = {}): PublicRecord[] {
  const conditions = [PUBLIC_ITEM_STATUS_SQL];
  const values: string[] = [];
  if (filters.type) { conditions.push("type = ?"); values.push(filters.type); }
  if (filters.topic) { conditions.push("topic = ?"); values.push(filters.topic); }
  if (filters.q) {
    conditions.push("(title LIKE ? OR summary LIKE ? OR tags LIKE ?)");
    values.push(...Array<string>(3).fill(`%${filters.q}%`));
  }
  const rows = getDb().prepare(
    `SELECT id,title,type,topic,author,summary,tags,status,updated,source_url FROM items WHERE ${conditions.join(" AND ")} ORDER BY updated DESC`,
  ).all(...values) as Record<string, unknown>[];
  return rows.map(row => decode("library", row));
}

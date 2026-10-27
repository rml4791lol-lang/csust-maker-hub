import { ensureDynamic, json } from "@/lib/api";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const topic = searchParams.get("topic");
  const q = searchParams.get("q");

  const db = getDb();
  let sql = "SELECT * FROM items";
  const conditions: string[] = [];
  const params: string[] = [];

  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }
  if (topic) {
    conditions.push("topic = ?");
    params.push(topic);
  }
  if (q) {
    conditions.push("(title LIKE ? OR summary LIKE ? OR tags LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY updated DESC";

  const rows = db.prepare(sql).all(...params) as Array<Record<string, string>>;
  return json(
    rows.map((r) => ({ ...r, tags: JSON.parse(r.tags) })),
  );
}

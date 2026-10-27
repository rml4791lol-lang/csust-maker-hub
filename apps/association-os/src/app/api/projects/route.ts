import { ensureDynamic, json } from "@/lib/api";
import { getDb } from "@/lib/db";

export async function GET() {
  await ensureDynamic();
  const db = getDb();
  const rows = db.prepare("SELECT * FROM projects ORDER BY updated DESC").all();
  return json(rows);
}

import { ensureDynamic, json } from "@/lib/api";
import { getDb } from "@/lib/db";

export async function GET() {
  await ensureDynamic();
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM departments ORDER BY active DESC")
    .all();
  return json(rows);
}

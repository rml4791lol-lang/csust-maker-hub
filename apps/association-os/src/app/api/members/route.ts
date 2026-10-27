import { ensureDynamic, json } from "@/lib/api";
import { getDb } from "@/lib/db";

export async function GET() {
  await ensureDynamic();
  const db = getDb();
  const rows = db.prepare("SELECT * FROM members ORDER BY id").all() as Array<{
    id: string;
    name: string;
    dept: string;
    role: string | null;
    grade: string;
    skills: string;
  }>;
  return json(
    rows.map((r) => ({ ...r, skills: JSON.parse(r.skills) })),
  );
}

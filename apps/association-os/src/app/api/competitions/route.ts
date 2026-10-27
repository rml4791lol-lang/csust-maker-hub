import { ensureDynamic, json } from "@/lib/api";
import { getDb } from "@/lib/db";

export async function GET() {
  await ensureDynamic();
  const db = getDb();
  const rows = db.prepare("SELECT * FROM competitions ORDER BY deadline").all() as Array<
    Record<string, string | number>
  >;
  return json(
    rows.map((r) => ({ ...r, members: JSON.parse(String(r.members)) })),
  );
}

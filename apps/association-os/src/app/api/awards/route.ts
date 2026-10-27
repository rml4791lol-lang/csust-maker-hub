import { ensureDynamic, json } from "@/lib/api";
import { getDb } from "@/lib/db";

export async function GET() {
  await ensureDynamic();
  const db = getDb();
  const rows = db.prepare("SELECT * FROM awards ORDER BY date DESC").all() as Array<
    Record<string, string | number>
  >;
  return json(
    rows.map((r) => ({
      ...r,
      has_certificate: Boolean(r.has_certificate),
      members: JSON.parse(String(r.members)),
    })),
  );
}

import { ensureDynamic, json } from "@/lib/api";
import { listPublicItems } from "@/lib/public-records";

export async function GET(request: Request) {
  await ensureDynamic();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const topic = searchParams.get("topic");
  const q = searchParams.get("q");

  return json(listPublicItems({ type, topic, q }));
}

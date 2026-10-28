import { ensureDynamic, json } from "@/lib/api";
import { adminConfigured, hasAdminSession } from "@/lib/admin-auth";
import { localAccountExists, usesEnvironmentAccount } from "@/lib/admin-account";

export async function GET(request: Request) {
  await ensureDynamic();
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (host) url.host = host;
  const setupAvailable = process.env.AI_ASSOCIATION_ALLOW_LOCAL_SETUP === "1"
    && !usesEnvironmentAccount() && !localAccountExists()
    && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  return json({ authenticated: await hasAdminSession(request), configured: adminConfigured(), setupAvailable }, { headers: { "Cache-Control": "private, no-store" } });
}

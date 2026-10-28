import type { ContentModule } from "@/lib/content-modules";

/** UI visibility only; server queries remain the authority for public access. */
export function isPublished(module: ContentModule, status: unknown) {
  if (module === "library") return ["已发布", "已收录", "报名中", "已归档"].includes(String(status));
  if (module === "footprints") return status === "approved";
  return true;
}

export function publishHref(module: ContentModule, id?: string) {
  return `/publish/${module}${id ? `/${encodeURIComponent(id)}` : ""}`;
}

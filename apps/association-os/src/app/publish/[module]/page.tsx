import { notFound } from "next/navigation";
import { PublishList } from "@/components/publish-list";
import { CONTENT_MODULES, type ContentModule } from "@/lib/content-modules";

export const instant = false;

export default async function PublishModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  if (!Object.hasOwn(CONTENT_MODULES, module)) notFound();
  return <PublishList module={module as ContentModule} />;
}

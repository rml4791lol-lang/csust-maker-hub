import { notFound } from "next/navigation";
import { RecordEditor } from "@/components/record-editor";
import { CONTENT_MODULES, type ContentModule } from "@/lib/content-modules";

export const instant = false;

export default async function NewPublishPage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  if (!Object.hasOwn(CONTENT_MODULES, module)) notFound();
  return <RecordEditor module={module as ContentModule} />;
}

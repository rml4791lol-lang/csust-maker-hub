import { notFound } from "next/navigation";
import { RecordEditor } from "@/components/record-editor";
import { CONTENT_MODULES, type ContentModule } from "@/lib/content-modules";

export const instant = false;

export default async function EditPublishPage({ params }: { params: Promise<{ module: string; id: string }> }) {
  const { module, id } = await params;
  if (!Object.hasOwn(CONTENT_MODULES, module)) notFound();
  return <RecordEditor module={module as ContentModule} id={id} />;
}

import { redirect } from "next/navigation";

export const instant = false;

export default async function EditRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/publish/activities/${encodeURIComponent(id)}`);
}

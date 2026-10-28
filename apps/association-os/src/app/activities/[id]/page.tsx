import { RecordDetail } from "@/components/record-detail";
export const instant = false;
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecordDetail module="activities" id={id} />;
}
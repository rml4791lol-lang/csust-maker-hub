import { redirect } from "next/navigation";

// Compatibility entry: rendering ends with a server redirect.
export const instant = false;

export default function NewRecordPage() {
  redirect("/publish/competitions/new");
}

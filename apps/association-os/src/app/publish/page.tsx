import { redirect } from "next/navigation";

// This route only redirects; it has no instant UI to validate.
export const instant = false;

export default function PublishPage() {
  redirect("/publish/library");
}

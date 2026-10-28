import type { ReactNode } from "react";
import { PublishNavigation } from "@/components/publish-navigation";

export default function PublishLayout({ children }: { children: ReactNode }) {
  return <><PublishNavigation />{children}</>;
}

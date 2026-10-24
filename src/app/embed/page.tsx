import type { Metadata } from "next";
import { TagsuBadge } from "@/tagsu/TagsuEditor";

export const metadata: Metadata = {
  title: "Tagsu badge in 3D",
  robots: { index: false },
};

export default function Page() {
  return <TagsuBadge />;
}

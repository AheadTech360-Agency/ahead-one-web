import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComponentGallery } from "./gallery";

export const metadata: Metadata = { title: "Component library" };

/** Development-only gallery of src/ui in both themes. Returns 404 in production builds. */
export default function DevComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ComponentGallery />;
}

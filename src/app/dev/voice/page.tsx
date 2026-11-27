import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Preview } from "./preview";

export const metadata: Metadata = { title: "Voice preview" };

/** Development-only preview of the voice bubble states on fixtures. 404 in production builds. */
export default function DevVoicePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Preview />;
}

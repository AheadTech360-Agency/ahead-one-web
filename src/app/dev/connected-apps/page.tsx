import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Preview } from "./preview";

export const metadata: Metadata = { title: "Connected apps preview" };

/** Development-only preview of the consent screen and Connected apps on fixtures. 404 in production builds. */
export default function DevConnectedAppsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}

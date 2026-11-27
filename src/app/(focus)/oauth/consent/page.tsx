import type { Metadata } from "next";
import { Suspense } from "react";
import { ConsentView } from "@/features/connected-apps/consent-view";
import { ConsentSkeleton } from "@/features/connected-apps/consent-card";

// The request id is the only secret-ish value in the URL: keep it out of Referer headers and search indexes.
export const metadata: Metadata = {
  title: "Connect an app",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function ConsentPage() {
  return (
    <Suspense fallback={<ConsentSkeleton />}>
      <ConsentView />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MessagingMock } from "./mock";

export const metadata: Metadata = { title: "Messaging preview" };

/**
 * Development-only preview of messaging, notifications and the inbox on fixture data
 * (?view=conversation|index|inbox, &c=<id>, &typing=1, &failed=1, &dialog=dm|channel|browse, &empty=1).
 * Returns 404 in production builds.
 */
export default function DevMessagingPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <MessagingMock />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { SetupMfa } from "./setup-mfa";

export const metadata: Metadata = { title: "Set up two-step verification" };

export default function SetupMfaPage() {
  return (
    <Suspense>
      <SetupMfa />
    </Suspense>
  );
}

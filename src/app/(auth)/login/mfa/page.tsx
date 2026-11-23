import type { Metadata } from "next";
import { Suspense } from "react";
import { MfaChallenge } from "./mfa-challenge";

export const metadata: Metadata = { title: "Two-step verification" };

export default function MfaPage() {
  return (
    <Suspense>
      <MfaChallenge />
    </Suspense>
  );
}

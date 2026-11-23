import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteFlow } from "./invite-flow";

export const metadata: Metadata = { title: "Join workspace" };

export default function InvitePage() {
  return (
    <Suspense>
      <InviteFlow />
    </Suspense>
  );
}

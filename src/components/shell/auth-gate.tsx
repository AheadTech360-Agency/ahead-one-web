"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { unregisterPushOnSignOut } from "@/features/push/push";
import { onBeforeSignOut, onSignedOut, signOut } from "@/lib/auth/client";
import { useWorkspace } from "@/lib/workspace";

/**
 * Client half of the route guard (proxy.ts only checks that a refresh cookie exists).
 * - Registers sign-out cleanup: remove this browser's push token first, then clear the query cache.
 * - Uses /v1/me as the authority: an Owner or Admin whose session skipped the emailed code
 *   (`mfa_required`) signs out and signs in again, which runs the code step.
 */
export function AuthGate() {
  const qc = useQueryClient();
  const { me } = useWorkspace();

  useEffect(() => {
    const offBefore = onBeforeSignOut(unregisterPushOnSignOut);
    const offAfter = onSignedOut(() => qc.clear());
    return () => {
      offBefore();
      offAfter();
    };
  }, [qc]);

  const mfaRequired = me?.mfa_required;
  useEffect(() => {
    if (mfaRequired) void signOut({ reason: "mfa" });
  }, [mfaRequired]);

  return null;
}

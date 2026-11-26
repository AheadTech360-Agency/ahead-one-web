"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { warmAfterLoad } from "@/lib/api/prefetch";
import { getAccessToken } from "@/lib/auth/client";
import { useWorkspace } from "@/lib/workspace";

/**
 * Startup helpers, rendered once inside the shell.
 * - Starts the session refresh at once, in parallel with the cache restore and the first renders,
 *   instead of when the first query happens to ask for a token.
 * - Once a workspace is known, warms the screens people open next (see warmAfterLoad).
 */
export function WarmCaches() {
  const qc = useQueryClient();
  const { workspaceId, role } = useWorkspace();

  useEffect(() => {
    void getAccessToken();
  }, []);

  useEffect(() => {
    if (workspaceId && role) warmAfterLoad(qc, workspaceId, role);
  }, [qc, workspaceId, role]);

  return null;
}

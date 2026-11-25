"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { createNoticeGate, onRefreshFailure, type RefreshFailureKind } from "@/lib/cache/refresh-errors";
import { toast } from "@/ui/toaster";

const ID = "refresh-failure";
const gate = createNoticeGate(8_000);

/**
 * The one place a failed background refresh is announced. Cached data stays on screen; this adds
 * a short, auto-dismissing toast with Retry (de-duplicated by `createNoticeGate` and a fixed toast id).
 * Coming back online retries the failed queries on its own.
 */
export function RefreshFailureNotice() {
  const qc = useQueryClient();

  useEffect(() => {
    const retry = () => {
      toast.dismiss(ID);
      gate.reset();
      void qc.refetchQueries({ predicate: (q) => q.state.status === "error" || (q.state.error !== null && q.state.data !== undefined) });
    };
    const show = (kind: RefreshFailureKind) => {
      if (!gate.allow(kind)) return;
      toast.warning(kind === "offline" ? "You're offline" : "Couldn't refresh", {
        id: ID,
        description: "Showing saved data.",
        duration: 6_000,
        action: { label: "Retry", onClick: retry },
      });
    };
    const off = onRefreshFailure(show);
    const onOnline = () => {
      toast.dismiss(ID);
      gate.reset();
      void qc.invalidateQueries({ refetchType: "active", predicate: (q) => q.state.error !== null });
    };
    window.addEventListener("online", onOnline);
    return () => {
      off();
      window.removeEventListener("online", onOnline);
    };
  }, [qc]);

  return null;
}

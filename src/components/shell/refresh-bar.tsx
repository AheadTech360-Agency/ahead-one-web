"use client";

import { useIsFetching } from "@tanstack/react-query";
import { useEffect, useState } from "react";

/** Background refreshes only: queries that already hold data, minus the quiet unread-count poll. */
const isBackgroundRefresh = {
  predicate: (q: { state: { data: unknown }; queryKey: readonly unknown[] }) =>
    q.state.data !== undefined && !(q.queryKey[0] === "notifications" && q.queryKey[1] === "unread-count"),
};

/**
 * A 2px bar along the top of the window while cached content is being refreshed behind the scenes.
 * Content never blanks for a refresh; this is the only sign of it. It waits 350 ms so quick
 * refetches never flash, and it is a static strip under reduced motion.
 */
export function RefreshBar() {
  const fetching = useIsFetching(isBackgroundRefresh) > 0;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!fetching) {
      const t = window.setTimeout(() => setShown(false), 150);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setShown(true), 350);
    return () => window.clearTimeout(t);
  }, [fetching]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[var(--z-toast)] h-0.5 overflow-hidden transition-opacity duration-[var(--dur-base)]"
      style={{ opacity: shown ? 1 : 0 }}
    >
      <div className="h-full w-2/5 bg-green motion-safe:animate-refresh motion-reduce:w-full motion-reduce:opacity-60" />
    </div>
  );
}

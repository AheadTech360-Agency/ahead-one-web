"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { qk } from "@/lib/api/keys";
import type { MeResponse } from "@/lib/api/types";
import { onSignedIn, onSignedOut } from "@/lib/auth/client";
import { decideScope } from "./policy";
import { bindPersistUser, getRestoredUserId, wipePersistedCache } from "./persister";

/**
 * Keeps the persisted cache scoped to the signed-in user.
 * - Whenever `/v1/me` resolves, a restored cache that belongs to someone else is wiped and the page
 *   reloads clean; otherwise the current user is bound as the owner (writes start).
 * - A fresh sign-in and sign-out both wipe the stored cache before anything else can read it.
 * Mounted once, inside the QueryClientProvider.
 */
export function CacheScopeGuard() {
  const qc = useQueryClient();

  useEffect(() => {
    const apply = () => {
      const me = qc.getQueryData<MeResponse>(qk.me());
      const id = me?.user.id;
      if (!id) return;
      if (decideScope(getRestoredUserId(), id) === "wipe") {
        void wipePersistedCache().finally(() => window.location.reload());
        return;
      }
      bindPersistUser(id);
    };
    apply();
    const off = qc.getQueryCache().subscribe((e) => {
      if (e.type === "updated" && e.query.queryKey[0] === "me" && e.query.state.status === "success") apply();
    });
    const offIn = onSignedIn(() => void wipePersistedCache());
    const offOut = onSignedOut(() => {
      qc.clear();
      return wipePersistedCache();
    });
    return () => {
      off();
      offIn();
      offOut();
    };
  }, [qc]);

  return null;
}

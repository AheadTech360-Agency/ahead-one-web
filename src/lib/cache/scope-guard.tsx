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
    // The user this page has already shown data for. If /v1/me ever names someone else (a session that
    // expired and another person signed in on the same tab), nothing from the first person may stay.
    let seen: string | undefined;
    const apply = () => {
      const me = qc.getQueryData<MeResponse>(qk.me());
      const id = me?.user.id;
      if (!id) return;
      if (seen && seen !== id) {
        qc.clear();
        void wipePersistedCache().finally(() => window.location.reload());
        return;
      }
      seen = id;
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
    // A fresh sign-in starts from nothing: clear what is in memory and what is stored, before the new
    // session can read either.
    const offIn = onSignedIn(() => {
      qc.clear();
      return wipePersistedCache();
    });
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

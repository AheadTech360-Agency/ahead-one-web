"use client";

import { useMemo } from "react";
import { useMembers } from "@/lib/api/hooks";
import type { UserSummary } from "@/lib/api/types";
import { useWorkspace } from "@/lib/workspace";
import type { People } from "./format";

/**
 * Everyone we can name in the current workspace, by id: workspace members plus any extra
 * people the caller has on hand (DM members, channel members, message authors).
 */
export function usePeople(extra: (UserSummary | null | undefined)[] = []): People {
  const { workspaceId, me } = useWorkspace();
  const members = useMembers(workspaceId);
  const key = extra.map((u) => u?.id ?? "").join(",");
  return useMemo(() => {
    const map: People = new Map();
    for (const m of members.data ?? []) map.set(m.user.id, m.user);
    for (const u of extra) if (u && !map.has(u.id)) map.set(u.id, u);
    if (me?.user && !map.has(me.user.id)) map.set(me.user.id, me.user);
    return map;
    // `extra` is compared by its ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.data, me?.user, key]);
}

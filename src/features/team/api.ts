"use client";

/*
 * Data layer for the team dashboards and the client-access setting. Options factories are shared
 * with the prefetchers, so a prefetch on hover is a cache hit when the view opens.
 */

import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import { STALE } from "@/lib/cache/stale";
import type { MemberClients, SetMemberClients, TeamDashboard } from "@/lib/api/types";

export const teamDashboardOptions = (ws: string | undefined, spaceId: string | undefined, enabled = true) =>
  queryOptions({
    queryKey: qk.workspace(ws ?? "").teamDashboard(spaceId),
    queryFn: ({ signal }) =>
      api<TeamDashboard>(`/v1/workspaces/${ws}/dashboard/team`, { query: { space_id: spaceId }, signal }),
    enabled: Boolean(ws) && enabled,
    staleTime: STALE.DASHBOARD,
  });

/**
 * `enabled` must be false for Member and Guest (the API answers 403). While the client or view
 * changes, the previous data stays on screen (keepPreviousData) so nothing blanks.
 */
export function useTeamDashboard(ws: string | undefined, spaceId: string | undefined, enabled: boolean) {
  return useQuery({ ...teamDashboardOptions(ws, spaceId, enabled), placeholderData: keepPreviousData });
}

/* ---------- Client access of an Admin (Owner only) ---------- */

export const memberClientsOptions = (ws: string | undefined, userId: string, enabled = true) =>
  queryOptions({
    queryKey: qk.workspace(ws ?? "").memberClients(userId),
    queryFn: ({ signal }) => api<MemberClients>(`/v1/workspaces/${ws}/members/${userId}/clients`, { signal }),
    enabled: Boolean(ws) && enabled,
    staleTime: STALE.PEOPLE,
  });

export function useMemberClients(ws: string | undefined, userId: string, enabled: boolean) {
  return useQuery(memberClientsOptions(ws, userId, enabled));
}

/** Optimistic: the new access shows at once and rolls back if the API refuses. */
export function useSetMemberClients(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: SetMemberClients }) =>
      api<MemberClients>(`/v1/workspaces/${ws}/members/${userId}/clients`, { method: "PUT", body }),
    onMutate: async ({ userId, body }) => {
      const key = qk.workspace(ws).memberClients(userId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<MemberClients>(key);
      qc.setQueryData<MemberClients>(key, body);
      return { key, previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.previous);
    },
    onSettled: (_d, _e, { userId }) => {
      void qc.invalidateQueries({ queryKey: qk.workspace(ws).memberClients(userId) });
      // What that Admin sees changed; nothing of ours is stale except our own audit trail.
      void qc.invalidateQueries({ queryKey: [...qk.workspace(ws).all, "audit-log"] });
    },
  });
}

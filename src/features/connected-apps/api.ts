"use client";

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api/client";
import type { OauthDecision, OauthDecisionResult, OauthGrant, OauthRequestInfo } from "@/lib/api/types";

/*
 * Query keys start with "oauth", which is deliberately NOT on the persisted-cache allowlist
 * (src/lib/cache/policy.ts): a consent request is single use and grants name other people, so none of
 * it is written to disk. Paths are collected here so a contract change is a one-file edit.
 */
const path = {
  request: (id: string) => `/v1/oauth/requests/${encodeURIComponent(id)}`,
  decision: (id: string) => `/v1/oauth/requests/${encodeURIComponent(id)}/decision`,
  grants: "/v1/oauth/grants",
  grant: (id: string) => `/v1/oauth/grants/${encodeURIComponent(id)}`,
  wsGrants: (ws: string) => `/v1/workspaces/${encodeURIComponent(ws)}/oauth/grants`,
  wsGrant: (ws: string, id: string) => `/v1/workspaces/${encodeURIComponent(ws)}/oauth/grants/${encodeURIComponent(id)}`,
};

export const oauthKeys = {
  request: (id: string) => ["oauth", "request", id] as const,
  grants: (ws?: string) => ["oauth", "grants", ws ?? "mine"] as const,
  grantsAll: ["oauth", "grants"] as const,
};

export const requestOptions = (id: string | undefined) =>
  queryOptions({
    queryKey: oauthKeys.request(id ?? ""),
    queryFn: ({ signal }) => api<OauthRequestInfo>(path.request(id!), { signal }),
    enabled: Boolean(id),
    // A request is a one-time record: never refetch behind the user's back, never keep it around.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    meta: { persist: false },
  });

export function useOAuthRequest(id: string | undefined) {
  return useQuery(requestOptions(id));
}

export function useOAuthDecision(id: string) {
  return useMutation({
    mutationFn: (body: OauthDecision) => api<OauthDecisionResult>(path.decision(id), { method: "POST", body }),
  });
}

/** `ws` set: the Owner's listing of every grant in that workspace; unset: the apps on my account. */
export const grantsOptions = (ws?: string) =>
  queryOptions({
    queryKey: oauthKeys.grants(ws),
    queryFn: ({ signal }) => api<OauthGrant[]>(ws ? path.wsGrants(ws) : path.grants, { signal }),
    staleTime: 30_000,
    meta: { persist: false },
  });

export function useOAuthGrants(ws: string | undefined, enabled = true) {
  return useQuery({ ...grantsOptions(ws), enabled });
}

/** Optimistic revoke: the row leaves every grants list at once and comes back if the API refuses. */
export function useRevokeGrant() {
  const qc = useQueryClient();
  return useMutation({
    // `viaWorkspace`: the Owner revoking from the workspace-wide list (someone else's grant, or any grant there).
    mutationFn: ({ grant, viaWorkspace }: { grant: OauthGrant; viaWorkspace: boolean }) =>
      api<void>(viaWorkspace ? path.wsGrant(grant.workspace_id, grant.id) : path.grant(grant.id), { method: "DELETE" }),
    onMutate: async ({ grant }) => {
      await qc.cancelQueries({ queryKey: oauthKeys.grantsAll });
      const snap = qc.getQueriesData<OauthGrant[]>({ queryKey: oauthKeys.grantsAll });
      qc.setQueriesData<OauthGrant[]>({ queryKey: oauthKeys.grantsAll }, (d) => d?.filter((g) => g.id !== grant.id));
      return { snap };
    },
    onError: (_e, _g, ctx) => {
      for (const [key, data] of ctx?.snap ?? []) qc.setQueryData(key, data);
    },
    onSettled: (_d, e) => {
      // Already revoked elsewhere (404) is the state the user wanted.
      if (!e || (isApiError(e) && e.status === 404)) void qc.invalidateQueries({ queryKey: oauthKeys.grantsAll });
    },
  });
}

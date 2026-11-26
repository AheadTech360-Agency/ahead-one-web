"use client";

import {
  keepPreviousData,
  type QueryClient,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { STALE } from "@/lib/cache/stale";
import { api } from "./client";
import { qk } from "./keys";
import type { AcceptInvite, AppRelease, AuditEntry, ChangePassword, Conversation, CreateInvite, ForgotPassword, Invite, InvitePreview, List, MeResponse, Member, Membership, Notification, NotificationChannels, NotificationPrefs, Page, Profile, Project, RegisterInvite, ResetPassword, Role, SetTwoFactor, Space, TestNotificationResult, TreeSpace, UnreadCount, UpdateMe } from "./types";

/* ---------- Me ---------- */

export const meOptions = () =>
  queryOptions({
    queryKey: qk.me(),
    queryFn: ({ signal }) => api<MeResponse>("/v1/me", { signal }),
    staleTime: STALE.STABLE,
    refetchOnWindowFocus: false,
  });

export function useMe(enabled = true) {
  return useQuery({ ...meOptions(), enabled });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMe) => api<Profile>("/v1/me", { method: "PATCH", body }),
    onSuccess: (user) => {
      qc.setQueryData<MeResponse>(qk.me(), (prev) => (prev ? { ...prev, user } : prev));
    },
  });
}

export function useRoles() {
  return useQuery({
    queryKey: qk.roles(),
    queryFn: ({ signal }) => api<Role[]>("/v1/roles", { signal }),
    staleTime: STALE.FOREVER,
  });
}

/* ---------- Account security ---------- */

/** Signs every other device out; this session stays. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePassword) => api<void>("/v1/me/password", { method: "PUT", body }),
  });
}

export function useSetTwoFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetTwoFactor) => api<void>("/v1/me/two-factor", { method: "PUT", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me() }),
  });
}

/** Public. Always 202, whether or not the address has an account. */
export function requestPasswordReset(email: string) {
  const body: ForgotPassword = { email };
  return api<void>("/v1/auth/password/forgot", { method: "POST", body, anonymous: true });
}

/** Public. Signs every session out. */
export function resetPassword(token: string, password: string) {
  const body: ResetPassword = { token, password };
  return api<void>("/v1/auth/password/reset", { method: "POST", body, anonymous: true });
}

/* ---------- Members ---------- */

export const membersOptions = (ws: string | undefined) =>
  queryOptions({
    queryKey: qk.workspace(ws ?? "").members(),
    queryFn: ({ signal }) => api<Member[]>(`/v1/workspaces/${ws}/members`, { signal }),
    enabled: Boolean(ws),
    staleTime: STALE.PEOPLE,
  });

export function useMembers(ws: string | undefined) {
  return useQuery(membersOptions(ws));
}

export function useUpdateMemberRole(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      api<Member>(`/v1/workspaces/${ws}/members/${userId}`, { method: "PATCH", body: { role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.workspace(ws).members() }),
  });
}

export function useRemoveMember(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api<void>(`/v1/workspaces/${ws}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.workspace(ws).members() }),
  });
}

/* ---------- Invites ---------- */

export function useInvites(ws: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.workspace(ws ?? "").invites(),
    queryFn: ({ signal }) => api<Invite[]>(`/v1/workspaces/${ws}/invites`, { signal }),
    enabled: Boolean(ws) && enabled,
  });
}

export function useCreateInvite(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInvite) =>
      api<Invite>(`/v1/workspaces/${ws}/invites`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.workspace(ws).invites() }),
  });
}

export function useResendInvite(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<Invite>(`/v1/workspaces/${ws}/invites/${id}/resend`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.workspace(ws).invites() }),
  });
}

export function useRevokeInvite(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/v1/workspaces/${ws}/invites/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.workspace(ws).invites() }),
  });
}

export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: qk.invitePreview(token),
    queryFn: ({ signal }) =>
      api<InvitePreview>("/v1/invites/preview", { query: { token }, signal, anonymous: true }),
    enabled: Boolean(token),
    staleTime: Infinity,
  });
}

/** Existing account: sign in first, then accept (AcceptInvite). */
export function acceptInvite(token: string) {
  const body: AcceptInvite = { token };
  return api<Membership>("/v1/invites/accept", { method: "POST", body });
}

/** New account: the server creates the account and the membership (public route). */
export function registerInvite(body: RegisterInvite) {
  return api<Membership>("/v1/invites/register", { method: "POST", body, anonymous: true });
}

/* ---------- Audit log ---------- */

export function useAuditLog(ws: string | undefined, filters: { action?: string; actor?: string }) {
  return useInfiniteQuery({
    queryKey: qk.workspace(ws ?? "").auditLog(filters),
    queryFn: ({ signal, pageParam }) =>
      api<Page<AuditEntry>>(`/v1/workspaces/${ws}/audit-log`, {
        signal,
        query: { action: filters.action, actor: filters.actor, cursor: pageParam, limit: 50 },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: Boolean(ws),
    placeholderData: keepPreviousData,
  });
}

/* ---------- Tree (sidebar) ---------- */

export const treeOptions = (ws: string | undefined) =>
  queryOptions({
    queryKey: qk.workspace(ws ?? "").tree(false),
    queryFn: ({ signal }) => api<TreeSpace[]>(`/v1/workspaces/${ws}/tree`, { signal }),
    enabled: Boolean(ws),
    staleTime: STALE.SEMI,
  });

export function useTree(ws: string | undefined) {
  return useQuery(treeOptions(ws));
}

export type TreeNodeKind = "space" | "project" | "list";

const treePath: Record<TreeNodeKind, string> = {
  space: "spaces",
  project: "projects",
  list: "lists",
};

export function useRenameNode(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id, name }: { kind: TreeNodeKind; id: string; name: string }) =>
      api<Space | Project | List>(`/v1/${treePath[kind]}/${id}`, {
        method: "PATCH",
        body: { name },
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["ws", ws, "tree"] }),
  });
}

export function useArchiveNode(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: TreeNodeKind; id: string }) =>
      api<Space | Project | List>(`/v1/${treePath[kind]}/${id}/archive`, { method: "POST" }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["ws", ws, "tree"] }),
  });
}

export function useCreateNode(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      kind,
      parentId,
      name,
    }: {
      kind: TreeNodeKind;
      parentId?: string;
      name: string;
    }): Promise<Space | Project | List> => {
      if (kind === "space") {
        return api<Space>(`/v1/workspaces/${ws}/spaces`, { method: "POST", body: { name } });
      }
      if (kind === "project") {
        return api<Project>(`/v1/spaces/${parentId}/projects`, { method: "POST", body: { name } });
      }
      return api<List>(`/v1/projects/${parentId}/lists`, { method: "POST", body: { name } });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["ws", ws, "tree"] }),
  });
}

/* ---------- Conversations ---------- */

export const conversationsOptions = (ws: string | undefined) =>
  queryOptions({
    queryKey: qk.workspace(ws ?? "").conversations(),
    queryFn: ({ signal }) => api<Conversation[]>(`/v1/workspaces/${ws}/conversations`, { signal }),
    enabled: Boolean(ws),
    // Kept current by the socket (and refetched after a reconnect); focus refetches would be wasted work.
    staleTime: STALE.REALTIME,
    refetchOnWindowFocus: false,
  });

export function useConversations(ws: string | undefined) {
  return useQuery(conversationsOptions(ws));
}

/* ---------- Notifications ---------- */

export function useUnreadCount() {
  return useQuery({
    queryKey: qk.notifications.unreadCount(),
    queryFn: ({ signal }) => api<UnreadCount>("/v1/notifications/unread-count", { signal }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useNotifications(unreadOnly: boolean, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.notifications.list(unreadOnly),
    queryFn: ({ signal, pageParam }) =>
      api<Page<Notification>>("/v1/notifications", {
        signal,
        query: { unread: unreadOnly ? true : undefined, cursor: pageParam },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/notifications/${id}/read`, { method: "POST" }),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notifications.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/v1/notifications/read-all", { method: "POST" }),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notifications.all }),
  });
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: qk.notifications.prefs(),
    queryFn: ({ signal }) => api<NotificationPrefs>("/v1/notification-prefs", { signal }),
    staleTime: STALE.STABLE,
  });
}

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NotificationPrefs) =>
      api<NotificationPrefs>("/v1/notification-prefs", { method: "PUT", body }),
    onSuccess: (data) => qc.setQueryData(qk.notifications.prefs(), data),
  });
}

/** Which channels the server can deliver on (email, push) and how many devices are registered. */
export function useNotificationChannels() {
  return useQuery({
    queryKey: qk.notifications.channels(),
    queryFn: ({ signal }) => api<NotificationChannels>("/v1/notifications/channels", { signal }),
    staleTime: 60_000,
  });
}

/** Sends one real test email and one test push to the signed-in person. */
export function useSendTestNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<TestNotificationResult>("/v1/notifications/test", { method: "POST" }),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notifications.channels() }),
  });
}

/* ---------- Android app release ---------- */

/** Release facts for display. The signed link is dropped here, so it is never rendered, cached or persisted from this query. */
export type AppReleaseInfo = Omit<AppRelease, "download_url" | "expires_at">;

export const appReleaseOptions = (ws: string | undefined) =>
  queryOptions({
    queryKey: qk.workspace(ws ?? "").appRelease(),
    queryFn: async ({ signal }): Promise<AppReleaseInfo> => {
      const r = await api<AppRelease>(`/v1/workspaces/${ws}/app/releases/android/latest`, { signal });
      return {
        version_name: r.version_name,
        version_code: r.version_code,
        notes: r.notes,
        size_bytes: r.size_bytes,
        sha256: r.sha256,
        updated_at: r.updated_at,
      };
    },
    staleTime: STALE.SEMI,
    refetchOnWindowFocus: false,
    meta: { persist: false },
  });

/** `enabled` must be false for guests: the endpoint is not requested for them at all. */
export function useAppRelease(ws: string | undefined, enabled: boolean) {
  return useQuery({ ...appReleaseOptions(ws), enabled: enabled && !!ws });
}

/**
 * A FRESH signed download link (valid 15 minutes). Always hits the API (staleTime 0) and is dropped from memory
 * at once (gcTime 0, never persisted). The caller navigates to it straight away and never stores or logs it.
 */
export function fetchFreshDownloadUrl(qc: QueryClient, ws: string): Promise<string> {
  return qc.fetchQuery({
    queryKey: qk.workspace(ws).appReleaseDownload(),
    queryFn: async ({ signal }) =>
      (await api<AppRelease>(`/v1/workspaces/${ws}/app/releases/android/latest`, { signal })).download_url,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    meta: { persist: false },
  });
}

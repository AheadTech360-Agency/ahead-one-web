"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiRequestError } from "@/lib/api/client";
import { chatKeys } from "@/lib/api/keys";
import { mimeForFile } from "@/lib/files/limits";
import { recordingMetaOf } from "@/lib/files/recording-meta";
import type {
  Attachment,
  Conversation,
  CreateChannel,
  DownloadUrl,
  Message,
  Page,
  ReadState,
  UpdateChannel,
  UploadTicket,
  UserSummary,
} from "@/lib/api/types";
import { insertConversation, markConversationRead, removeConversation, upsertMessage, updateConversation } from "./cache";
import { pendingStore } from "./stores";

export const PAGE_SIZE = 50;

/* ---------- Conversations ---------- */

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: chatKeys.conversation(id ?? ""),
    queryFn: ({ signal }) => api<Conversation>(`/v1/conversations/${id}`, { signal }),
    enabled: Boolean(id),
  });
}

export function useBrowseChannels(ws: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.browse(ws ?? ""),
    queryFn: ({ signal }) => api<Conversation[]>(`/v1/workspaces/${ws}/channels/browse`, { signal }),
    enabled: Boolean(ws) && enabled,
  });
}

export function useChannelMembers(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: chatKeys.members(id ?? ""),
    queryFn: ({ signal }) => api<UserSummary[]>(`/v1/conversations/${id}/members`, { signal }),
    enabled: Boolean(id) && enabled,
  });
}

export function useOpenDm(ws: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api<Conversation>(`/v1/workspaces/${ws}/dms`, { method: "POST", body: { user_id: userId } }),
    onSuccess: (c) => insertConversation(qc, c),
  });
}

export function useCreateChannel(ws: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateChannel) => api<Conversation>(`/v1/workspaces/${ws}/channels`, { method: "POST", body }),
    onSuccess: (c) => insertConversation(qc, c),
  });
}

export function useJoinChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<Conversation>(`/v1/conversations/${id}/join`, { method: "POST" }),
    onSuccess: (c) => {
      insertConversation(qc, c);
      qc.setQueryData<Conversation[]>(chatKeys.browse(c.workspace_id), (list) => list?.filter((x) => x.id !== c.id));
    },
  });
}

export function useLeaveChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: Conversation) => api<void>(`/v1/conversations/${c.id}/leave`, { method: "POST" }),
    onSuccess: (_, c) => {
      removeConversation(qc, c.id);
      void qc.invalidateQueries({ queryKey: chatKeys.browse(c.workspace_id) });
    },
  });
}

export function useUpdateChannel(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateChannel) => api<Conversation>(`/v1/conversations/${id}`, { method: "PATCH", body }),
    onSuccess: (c) => updateConversation(qc, id, (prev) => ({ ...prev, name: c.name, topic: c.topic, is_private: c.is_private })),
  });
}

export function useAddChannelMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (user: UserSummary) => api<void>(`/v1/conversations/${id}/members/${user.id}`, { method: "PUT" }),
    onSuccess: (_, user) => {
      qc.setQueryData<UserSummary[]>(chatKeys.members(id), (list) =>
        list && !list.some((u) => u.id === user.id) ? [...list, user] : list,
      );
      updateConversation(qc, id, (c) => ({ ...c, member_count: c.member_count + 1 }));
    },
  });
}

export function useRemoveChannelMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api<void>(`/v1/conversations/${id}/members/${userId}`, { method: "DELETE" }),
    onSuccess: (_, userId) => {
      qc.setQueryData<UserSummary[]>(chatKeys.members(id), (list) => list?.filter((u) => u.id !== userId));
      updateConversation(qc, id, (c) => ({ ...c, member_count: Math.max(0, c.member_count - 1) }));
    },
  });
}

/* ---------- Messages ---------- */

export function useMessages(id: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(id),
    queryFn: ({ signal, pageParam }) =>
      api<Page<Message>>(`/v1/conversations/${id}/messages`, {
        signal,
        query: { before: pageParam, limit: PAGE_SIZE },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled,
    // Live updates arrive over the socket; refetching every page on focus is wasted work.
    refetchOnWindowFocus: false,
    staleTime: 5 * 60_000,
  });
}

export function useReadStates(id: string, enabled = true) {
  return useQuery({
    queryKey: chatKeys.readStates(id),
    queryFn: ({ signal }) => api<ReadState[]>(`/v1/conversations/${id}/read-states`, { signal }),
    enabled,
  });
}

function tempId() {
  return `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Optimistic send: the message shows at once as "sending", turns into the real one when the
 * POST returns (or when its realtime echo lands first), and stays as "failed" with Retry otherwise.
 */
export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();

  async function post(id: string) {
    const p = pendingStore.get(id);
    if (!p) return;
    pendingStore.update(id, { status: "sending", error: undefined });
    try {
      const m = await api<Message>(`/v1/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { body: p.body, attachment_ids: p.attachments.length ? p.attachments.map((a) => a.id) : undefined },
      });
      pendingStore.remove(id);
      upsertMessage(qc, m);
      updateConversation(
        qc,
        conversationId,
        (c) => ({ ...c, last_message: m, unread_count: 0, last_read_message_id: m.id }),
        { bump: true },
      );
    } catch (e) {
      pendingStore.update(id, {
        status: "failed",
        error: e instanceof ApiRequestError ? e.message : undefined,
      });
      throw e;
    }
  }

  return {
    send(body: string, attachments: Attachment[] = []) {
      const id = tempId();
      pendingStore.add({
        tempId: id,
        conversationId,
        body,
        attachments,
        createdAt: new Date().toISOString(),
        status: "sending",
      });
      return post(id);
    },
    retry: (id: string) => post(id),
    discard: (id: string) => pendingStore.remove(id),
  };
}

export function useEditMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api<Message>(`/v1/messages/${id}`, { method: "PATCH", body: { body } }),
    onSuccess: (m) => {
      upsertMessage(qc, m);
      updateConversation(qc, m.conversation_id, (c) => (c.last_message?.id === m.id ? { ...c, last_message: m } : c));
    },
  });
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: Message) => api<void>(`/v1/messages/${m.id}`, { method: "DELETE" }),
    onSuccess: (_, m) => {
      upsertMessage(qc, { ...m, body: "", attachments: [], deleted: true });
      updateConversation(qc, m.conversation_id, (c) =>
        c.last_message?.id === m.id ? { ...c, last_message: { ...m, body: "", attachments: [], deleted: true } } : c,
      );
    },
  });
}

/** POST /read; the badge clears locally first. Failures are silent: the next read retries. */
export function useMarkRead() {
  const qc = useQueryClient();
  return (conversationId: string, messageId: string) => {
    markConversationRead(qc, conversationId, messageId);
    void api<void>(`/v1/conversations/${conversationId}/read`, {
      method: "POST",
      body: { message_id: messageId },
    }).catch(() => {
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "ws" && q.queryKey[2] === "conversations" });
    });
  };
}

/* ---------- Attachments ---------- */

export const MAX_ATTACHMENTS = 10;

function putWithProgress(url: string, file: File, mime: string, onProgress: (f: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", mime);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiRequestError(xhr.status, "unknown", "The upload didn't finish."));
    xhr.onerror = () => reject(new ApiRequestError(0, "network", "The upload was interrupted."));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

/** upload-url -> PUT the file -> confirm. Resolves with the ready attachment. */
export async function uploadAttachment(
  conversationId: string,
  file: File,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<Attachment> {
  const mime = mimeForFile(file);
  const ticket = await api<UploadTicket>(`/v1/conversations/${conversationId}/attachments/upload-url`, {
    method: "POST",
    body: { filename: file.name, mime, size_bytes: file.size, recording: recordingMetaOf(file) },
    signal,
  });
  await putWithProgress(ticket.upload_url, file, mime, onProgress, signal);
  return api<Attachment>(`/v1/attachments/${ticket.attachment_id}/confirm`, { method: "POST", signal });
}

/** Signed download URLs live 60 s; cache them for 45. */
export function useAttachmentUrl(id: string, enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.attachmentUrl(id),
    queryFn: ({ signal }) => api<DownloadUrl>(`/v1/attachments/${id}/download-url`, { signal }),
    enabled,
    staleTime: 45_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function fetchAttachmentUrl(id: string, inline = false) {
  return api<DownloadUrl>(`/v1/attachments/${id}/download-url`, { query: inline ? { inline: true } : undefined });
}


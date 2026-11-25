"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiRequestError } from "@/lib/api/client";
import { chatKeys, qk } from "@/lib/api/keys";
import type { Attachment, AttachToTask, CreateRecording, DownloadUrl, FileItem, FilesSummary, UploadTicket } from "@/lib/api/types";
import { buildFilesQuery, FILE_PAGE, nextCursor, type FileFilters } from "@/lib/files/files-query";

/* ---------- Reads ---------- */

export function useFiles(ws: string | undefined, filters: FileFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.workspace(ws ?? "").files(filters),
    queryFn: ({ pageParam, signal }) =>
      api<FileItem[]>(`/v1/workspaces/${ws}/files`, { query: buildFilesQuery(filters, pageParam || undefined), signal }),
    initialPageParam: "",
    getNextPageParam: (last) => nextCursor(last, (f) => f.attachment.id, FILE_PAGE) ?? undefined,
    enabled: Boolean(ws) && enabled,
    staleTime: 15_000,
  });
}

export function useFilesSummary(ws: string | undefined) {
  return useQuery({
    queryKey: qk.workspace(ws ?? "").filesSummary(),
    queryFn: ({ signal }) => api<FilesSummary>(`/v1/workspaces/${ws}/files/summary`, { signal }),
    enabled: Boolean(ws),
    staleTime: 30_000,
  });
}

/** A signed URL (60 s). Opening it restarts the file's retention clock, so only ask when the user acts. */
export function fetchDownloadUrl(id: string, inline = false, signal?: AbortSignal) {
  return api<DownloadUrl>(`/v1/attachments/${id}/download-url`, { query: inline ? { inline: true } : undefined, signal });
}

export async function downloadFile(id: string) {
  const { url } = await fetchDownloadUrl(id);
  window.location.assign(url);
}

/* ---------- Writes ---------- */

export function useInvalidateFiles() {
  const qc = useQueryClient();
  return (ws: string | undefined) => {
    if (ws) void qc.invalidateQueries({ queryKey: qk.workspace(ws).filesAll() });
  };
}

export function useDeleteFile(ws: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/attachments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      if (ws) void qc.invalidateQueries({ queryKey: qk.workspace(ws).filesAll() });
      // The file may be shown on a task or in a conversation.
      void qc.invalidateQueries({ queryKey: ["task"] });
      void qc.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}

export function useAttachToTask(ws: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { attachmentId: string; taskId: string }) => {
      const body: AttachToTask = { task_id: p.taskId };
      return api<Attachment>(`/v1/attachments/${p.attachmentId}/attach-to-task`, { method: "POST", body });
    },
    onSuccess: (_a, p) => {
      if (ws) void qc.invalidateQueries({ queryKey: qk.workspace(ws).filesAll() });
      void qc.invalidateQueries({ queryKey: ["task", p.taskId] });
      void qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

/* ---------- Upload ---------- */

/** PUT a blob to a signed URL with progress. content-type must match what was signed; the browser sets content-length. */
export function putBlob(url: string, blob: Blob, mime: string, onProgress: (fraction: number) => void, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", mime);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiRequestError(xhr.status, "unknown", "Storage didn't accept the upload."));
    xhr.onerror = () => reject(new ApiRequestError(0, "unknown", "The upload didn't reach file storage. Check your connection and retry. If it keeps failing, ask an admin to check the storage settings."));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

export type RecordingMeta = { title: string; mime: string; sizeBytes: number; durationSecs: number; hasAudio: boolean };

/**
 * Save a recording to the caller's private library: create, PUT, confirm. `ticket` is a ticket from an
 * earlier failed attempt: it is reused so a retry doesn't leave a second pending recording behind, and
 * replaced by a fresh one if storage says it has expired.
 */
export async function saveRecording(
  ws: string,
  blob: Blob,
  meta: RecordingMeta,
  opts: {
    onProgress: (fraction: number) => void;
    onTicket: (t: UploadTicket) => void;
    signal: AbortSignal;
    ticket?: UploadTicket;
  },
): Promise<Attachment> {
  const { onProgress, onTicket, signal } = opts;
  const create = async () => {
    const body: CreateRecording = {
      title: meta.title,
      mime: meta.mime,
      size_bytes: meta.sizeBytes,
      duration_secs: meta.durationSecs,
      has_audio: meta.hasAudio,
    };
    const t = await api<UploadTicket>(`/v1/workspaces/${ws}/recordings`, { method: "POST", body, signal });
    onTicket(t);
    return t;
  };
  let t = opts.ticket ?? (await create());
  try {
    await putBlob(t.upload_url, blob, meta.mime, onProgress, signal);
  } catch (e) {
    if (opts.ticket && e instanceof ApiRequestError && e.status === 403) {
      t = await create();
      await putBlob(t.upload_url, blob, meta.mime, onProgress, signal);
    } else throw e;
  }
  return api<Attachment>(`/v1/attachments/${t.attachment_id}/confirm`, { method: "POST", signal });
}

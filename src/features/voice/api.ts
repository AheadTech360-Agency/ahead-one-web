"use client";

import { api } from "@/lib/api/client";
import type { Attachment, UploadTicket } from "@/lib/api/types";
import { fetchAttachmentUrl, putWithProgress } from "@/features/messages/api";
import type { CreateVoiceUpload, VoiceUploadMeta } from "./contract";
import { baseMime } from "./logic";

/** upload-url (with the voice meta) -> PUT the blob -> confirm. Resolves with the ready attachment. */
export async function uploadVoice(
  conversationId: string,
  blob: Blob,
  mime: string,
  meta: VoiceUploadMeta,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<Attachment> {
  const type = baseMime(mime);
  const ext = type === "audio/mp4" ? "m4a" : type === "audio/ogg" ? "ogg" : "webm";
  const body: CreateVoiceUpload = { filename: `voice-message.${ext}`, mime: type, size_bytes: blob.size, voice: meta };
  const ticket = await api<UploadTicket>(`/v1/conversations/${conversationId}/attachments/upload-url`, { method: "POST", body, signal });
  await putWithProgress(ticket.upload_url, blob, type, onProgress, signal);
  return api<Attachment>(`/v1/attachments/${ticket.attachment_id}/confirm`, { method: "POST", signal });
}

/** Someone else's message started playing: tell the API once (204). */
export function reportPlayed(attachmentId: string) {
  return api<void>(`/v1/attachments/${attachmentId}/played`, { method: "POST", quiet: true });
}

/** Fresh signed playback URL; never cached by the query layer (see logic.urlNeedsRefresh). */
export async function fetchVoiceUrl(attachmentId: string): Promise<string> {
  return (await fetchAttachmentUrl(attachmentId, true)).url;
}

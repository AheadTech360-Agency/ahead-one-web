/*
 * LOCAL SHAPES for the voice-message contract. The API implements it after this UI, so the generated
 * types do not have it yet (`Attachment.kind` is "file" | "recording", `CreateUpload` has no `voice`,
 * there is no `voice.played` event). When `npm run sync-types` brings the real types, delete this file
 * and read the fields straight off Attachment / CreateUpload / WsServerEvent.
 */
import type { Attachment, CreateUpload } from "@/lib/api/types";

export type VoiceUploadMeta = {
  /** 1..300 */
  duration_secs: number;
  /** Exactly 64 integers, 0..255. */
  waveform: number[];
};

export type CreateVoiceUpload = CreateUpload & { voice?: VoiceUploadMeta };

/** Attachment as the API will return it for a voice message. */
export type VoiceAttachment = Omit<Attachment, "kind"> & {
  kind: "voice";
  waveform: number[] | null;
  played_by: string[];
};

/** Realtime frame: someone started playing a voice message. */
export type VoicePlayedEvent = {
  type: "voice.played";
  conversation_id: string;
  message_id: string;
  attachment_id: string;
  user_id: string;
};

/**
 * Feature flag. Off in production builds until the API ships the endpoints (set
 * NEXT_PUBLIC_VOICE_MESSAGES=1 to turn it on); on in development so the UI can be worked on.
 */
export const VOICE_ENABLED =
  process.env.NEXT_PUBLIC_VOICE_MESSAGES === "1" || process.env.NODE_ENV !== "production";

/** Read the voice fields off an attachment, whether or not the generated type knows them yet. */
export function asVoice(a: Attachment): VoiceAttachment | null {
  const v = a as unknown as Partial<VoiceAttachment>;
  return v.kind === "voice" ? (a as unknown as VoiceAttachment) : null;
}

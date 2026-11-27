import type { QueryClient } from "@tanstack/react-query";
import { chatKeys } from "@/lib/api/keys";
import type { Attachment } from "@/lib/api/types";
import type { MessagePages } from "@/features/messages/cache";
import type { VoicePlayedEvent } from "./contract";
import { withPlayed } from "./logic";

/** Realtime `voice.played`: add the listener to `played_by` of that attachment in the cached message pages. */
export function applyVoicePlayed(qc: QueryClient, ev: VoicePlayedEvent) {
  qc.setQueryData<MessagePages>(chatKeys.messages(ev.conversation_id), (data) => {
    if (!data) return data;
    return {
      ...data,
      pages: data.pages.map((p) => ({
        ...p,
        items: p.items.map((m) =>
          m.id !== ev.message_id
            ? m
            : {
                ...m,
                attachments: m.attachments.map((a) => {
                  if (a.id !== ev.attachment_id) return a;
                  const v = a as Attachment & { played_by?: string[] };
                  return { ...a, played_by: withPlayed(v.played_by ?? [], ev.user_id) } as Attachment;
                }),
              },
        ),
      })),
    };
  });
}

export function isVoicePlayedEvent(ev: { type: string }): ev is VoicePlayedEvent {
  return ev.type === "voice.played";
}

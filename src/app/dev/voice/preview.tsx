"use client";

import type { Attachment } from "@/lib/api/types";
import type { VoiceAttachment } from "@/features/voice/contract";
import { peakBars } from "@/features/voice/logic";
import { VoiceBubble } from "@/features/voice/voice-bubble";

const wave = peakBars(Array.from({ length: 2000 }, (_, i) => Math.abs(Math.sin(i / 40)) * (0.3 + 0.7 * Math.abs(Math.sin(i / 310)))));
const base = {
  filename: "voice-message.webm",
  mime: "audio/webm",
  size_bytes: 40000,
  uploader: null,
  created_at: "2026-11-27T10:00:00Z",
  has_audio: null,
} satisfies Partial<Attachment>;
const v = (id: string, played_by: string[]): VoiceAttachment => ({ ...base, id, kind: "voice", duration_secs: 23, waveform: wave, played_by });

export function Preview() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 bg-bg p-6">
      <p className="text-13 text-fg-muted">Someone else, not played yet (green dot)</p>
      <VoiceBubble a={v("a1", [])} mine={false} meId="me" />
      <p className="text-13 text-fg-muted">Mine, not played (grey mic)</p>
      <VoiceBubble a={v("a2", [])} mine meId="me" />
      <p className="text-13 text-fg-muted">Mine, played by someone (blue mic)</p>
      <VoiceBubble a={v("a3", ["someone-else"])} mine meId="me" />
    </div>
  );
}

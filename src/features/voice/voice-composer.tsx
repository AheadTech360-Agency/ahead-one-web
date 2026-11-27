"use client";

import { ArrowUp, CircleAlert, MicOff, Mic, Pause, Play, RotateCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import type { Attachment } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { IconButton } from "@/ui/icon-button";
import { Spinner } from "@/ui/spinner";
import { toast } from "@/ui/toaster";
import { uploadVoice } from "./api";
import { COUNTDOWN_FROM_SECS, checkVoiceUpload, clock, elapsedMs, remainingSecs } from "./logic";
import { useVoiceRecorder, type RecordedVoice } from "./use-voice-recorder";
import { Waveform } from "./waveform";

type Pending = { voice: RecordedVoice; progress: number; status: "uploading" | "error"; error?: string; controller: AbortController };

/**
 * Voice recording for the composer. `onReady` gets the confirmed attachment, ready to send as a message
 * with an empty body. While `active` the composer swaps its text box for `strip`.
 */
export function useVoiceMessage(conversationId: string, onReady: (a: Attachment) => void) {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef(pending);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    pendingRef.current = pending;
    onReadyRef.current = onReady;
  });

  const upload = useCallback(
    (voice: RecordedVoice) => {
      const problem = checkVoiceUpload({ mime: voice.mime, size: voice.blob.size, durationSecs: voice.durationSecs, waveform: voice.waveform });
      if (problem) {
        setPending(null);
        toast.error("Couldn't send the voice message", { description: problem });
        return;
      }
      const controller = new AbortController();
      setPending({ voice, progress: 0, status: "uploading", controller });
      uploadVoice(
        conversationId,
        voice.blob,
        voice.mime,
        { duration_secs: voice.durationSecs, waveform: voice.waveform },
        (progress) => setPending((p) => (p && p.controller === controller ? { ...p, progress } : p)),
        controller.signal,
      )
        .then((att) => {
          setPending((p) => (p && p.controller === controller ? null : p));
          onReadyRef.current(att);
        })
        .catch((e) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setPending((p) => (p && p.controller === controller ? { ...p, status: "error", error: errorMessage(e, "The upload didn't finish.") } : p));
        });
    },
    [conversationId],
  );

  const rec = useVoiceRecorder(upload);

  // Leaving the conversation drops an unsent upload.
  useEffect(() => () => pendingRef.current?.controller.abort(), []);

  const phase = rec.state.phase;
  const notice = phase === "denied" || phase === "unsupported" || phase === "error" ? phase : null;

  const recording = phase === "requesting" || phase === "recording" || phase === "paused";
  const active = recording || pending !== null || notice !== null;
  const holdStart = useRef(0);

  const strip = !active ? null : (
    <div className="px-2 py-2" data-testid="voice-strip">
      {notice && !recording && !pending && (
        <div role="alert" className="flex items-start gap-2.5 rounded-sm bg-surface-sunken px-3 py-2.5 text-13 text-fg-muted">
          <MicOff className="mt-0.5 size-4 shrink-0 text-fg" aria-hidden />
          <p className="min-w-0 flex-1">
            {notice === "denied" && (
              <>
                <span className="font-medium text-fg">Microphone access is blocked.</span> Allow it for this site in your browser&apos;s address bar
                settings, then try again.
              </>
            )}
            {notice === "unsupported" && (
              <>
                <span className="font-medium text-fg">This browser can&apos;t record voice messages.</span> Use a current Chrome, Edge, Firefox or
                Safari.
              </>
            )}
            {notice === "error" && (
              <>
                <span className="font-medium text-fg">Couldn&apos;t use the microphone.</span> Check that one is connected and not in use by another app.
              </>
            )}
          </p>
          {notice !== "unsupported" && (
            <button type="button" onClick={() => void rec.start()} className="rounded-xs text-13 font-medium text-fg underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring">
              Try again
            </button>
          )}
          <IconButton label="Dismiss" size="sm" className="size-6" onClick={rec.reset}>
            <X aria-hidden />
          </IconButton>
        </div>
      )}

      {recording && (
        <div className="flex items-center gap-2" role="group" aria-label="Recording a voice message">
          <IconButton label="Cancel recording" size="sm" onClick={rec.cancel}>
            <Trash2 aria-hidden />
          </IconButton>
          <span
            aria-hidden
            className={cn("size-2.5 shrink-0 rounded-full bg-danger", phase === "recording" && "motion-safe:animate-pulse", phase === "paused" && "opacity-40")}
          />
          <span className="min-w-[2.75rem] text-13 font-medium tabular text-fg" aria-live="off" data-testid="voice-timer">
            {phase === "requesting" ? "Allow mic" : clock(rec.elapsed / 1000)}
          </span>
          <LiveLevel live={rec.live} paused={phase !== "recording"} />
          {phase !== "requesting" && remainingSecs(rec.state, rec.now) <= COUNTDOWN_FROM_SECS && (
            <span className="text-11 font-medium tabular text-danger-text" role="status">
              {remainingSecs(rec.state, rec.now)}s left
            </span>
          )}
          <IconButton
            label={phase === "paused" ? "Resume recording" : "Pause recording"}
            size="sm"
            disabled={phase === "requesting"}
            onClick={phase === "paused" ? rec.resume : rec.pause}
          >
            {phase === "paused" ? <Play aria-hidden /> : <Pause aria-hidden />}
          </IconButton>
          <button
            type="button"
            onClick={() => {
              if (elapsedMs(rec.state, rec.now) < 1000) {
                toast("Hold a little longer. Voice messages need at least a second.");
                rec.cancel();
              } else rec.stop();
            }}
            disabled={phase === "requesting"}
            aria-label="Send voice message"
            className="inline-flex size-7 items-center justify-center rounded-sm bg-accent text-fg-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            <ArrowUp className="size-4" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      )}

      {pending && !recording && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-sm border px-2.5 py-2",
            pending.status === "error" ? "border-danger bg-danger-subtle" : "border-border bg-surface-sunken",
          )}
          data-testid="voice-pending"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-fg-muted">
            {pending.status === "uploading" ? <Spinner size={14} label="Uploading voice message" /> : <CircleAlert className="size-4 text-danger-text" aria-hidden />}
          </span>
          <Waveform bars={pending.voice.waveform} progress={pending.status === "uploading" ? pending.progress : 0} className="min-w-0 flex-1" />
          <span className={cn("text-12 tabular", pending.status === "error" ? "text-danger-text" : "text-fg-muted")}>
            {pending.status === "uploading" ? `${Math.round(pending.progress * 100)}%` : (pending.error ?? "Failed")}
          </span>
          {pending.status === "error" && (
            <IconButton label="Retry sending voice message" size="sm" className="size-6" onClick={() => upload(pending.voice)}>
              <RotateCw aria-hidden />
            </IconButton>
          )}
          <IconButton label="Discard voice message" size="sm" className="size-6" onClick={() => { pending.controller.abort(); setPending(null); rec.reset(); }}>
            <Trash2 aria-hidden />
          </IconButton>
        </div>
      )}
    </div>
  );

  /**
   * Mouse and keyboard: click starts recording. Touch: pressing starts it at once, and releasing after
   * a hold of half a second sends it; a quick tap leaves it recording (tap the arrow to send).
   */
  const mic = (
    <IconButton
      label="Record a voice message"
      size="sm"
      data-testid="voice-mic"
      onClick={(e) => {
        if ((e.nativeEvent as PointerEvent).pointerType === "touch") return;
        void rec.start();
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== "touch") return;
        holdStart.current = Date.now();
        void rec.start();
      }}
      onPointerUp={(e) => {
        if (e.pointerType !== "touch" || holdStart.current <= 0) return;
        const held = Date.now() - holdStart.current;
        holdStart.current = 0;
        if (held >= 500 && rec.state.phase === "recording") rec.stop();
      }}
    >
      <Mic aria-hidden />
    </IconButton>
  );

  return { active, strip, micButton: mic, recording };
}

/** The last ~2.4 s of microphone level as bars (a rolling meter, not the final waveform). */
function LiveLevel({ live, paused }: { live: number[]; paused: boolean }) {
  const bars = Array.from({ length: 48 }, (_, i) => {
    const v = live[live.length - 48 + i];
    return v === undefined ? 0 : Math.round(Math.min(1, v * 2.2) * 255);
  });
  return <Waveform bars={bars} className={cn("min-w-0 flex-1", paused && "opacity-50")} barClass="bg-fg-muted" />;
}

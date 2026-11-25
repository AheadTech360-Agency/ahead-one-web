"use client";

import { Mic, Pause, Play, Square, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock, MAX_RECORDING_SECS } from "@/lib/files/recording";
import { useRecorderInternal } from "./provider";

const ctl =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-sm px-2.5 text-13 font-semibold transition-colors duration-[var(--dur-fast)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-band-fg";

/** Countdown, then a floating control bar that stays put while the user works in the app (or another window). */
export function RecorderHud() {
  const r = useRecorderInternal();

  if (r.phase === "countdown") {
    return (
      <div className="fixed inset-0 z-[var(--z-toast)] flex flex-col items-center justify-center gap-6 bg-overlay" role="alertdialog" aria-label="Recording is about to start">
        <div className="flex flex-col items-center gap-2 text-band-fg">
          <p className="text-14 font-medium text-band-strong">Recording starts in</p>
          <p key={r.count} className="figure text-[120px] font-medium leading-none motion-safe:animate-[in-pop_var(--dur-slow)_var(--ease-out)]" aria-live="assertive" data-testid="countdown">
            {Math.max(r.count, 1)}
          </p>
        </div>
        <button
          type="button"
          onClick={r.requestDiscard}
          className="h-9 rounded-sm border border-band-line px-4 text-13 font-semibold text-band-fg hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-band-fg"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (r.phase !== "recording" && r.phase !== "paused") return null;

  const paused = r.phase === "paused";
  const frac = Math.min(1, r.elapsedMs / (MAX_RECORDING_SECS * 1000));
  const left = MAX_RECORDING_SECS * 1000 - r.elapsedMs;
  const lastMinute = left <= 60_000;

  return (
    <section
      aria-label="Screen recording controls"
      data-testid="recorder-hud"
      className="fixed bottom-5 left-1/2 z-[var(--z-toast)] w-[min(94vw,460px)] -translate-x-1/2 overflow-hidden rounded-md bg-band text-band-fg shadow-dialog"
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            aria-hidden
            className={cn("size-3 shrink-0 rounded-full bg-danger", !paused && "motion-safe:animate-pulse")}
          />
          <span className="text-13 font-semibold">{paused ? "Paused" : "Recording"}</span>
          <span className="figure text-16 font-medium tabular" data-testid="recorder-timer">
            {formatClock(r.elapsedMs)}
          </span>
          <span className={cn("hidden text-12 tabular sm:inline", lastMinute ? "text-warning-subtle" : "text-band-dim")}>
            {lastMinute ? `${Math.max(0, Math.ceil(left / 1000))}s left` : `of ${formatClock(MAX_RECORDING_SECS * 1000)}`}
          </span>
          {r.review === null && r.options.voice && <Mic className="size-3.5 shrink-0 text-band-muted" aria-label="Microphone on" />}
        </span>
        <button type="button" onClick={paused ? r.resume : r.pause} className={cn(ctl, "text-band-fg hover:bg-white/10")} data-testid="recorder-pause">
          {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" onClick={r.stop} className={cn(ctl, "bg-green text-navy-deep hover:brightness-110")} data-testid="recorder-stop">
          <Square className="size-3.5" fill="currentColor" aria-hidden /> Stop
        </button>
        <button type="button" onClick={r.requestDiscard} aria-label="Discard recording" title="Discard recording" className={cn(ctl, "px-2 text-band-muted hover:bg-white/10 hover:text-band-fg")}>
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      <div className="h-[3px] bg-white/15" aria-hidden>
        <div className={cn("h-full", lastMinute ? "bg-danger" : "bg-green")} style={{ width: `${frac * 100}%` }} />
      </div>
      <p className="sr-only" role="status">
        {paused ? "Recording paused" : "Recording"}
      </p>
    </section>
  );
}

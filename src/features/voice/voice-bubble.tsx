"use client";

import { CircleAlert, Mic, Pause, Play, WifiOff } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/ui/spinner";
import { fetchVoiceUrl, reportPlayed } from "./api";
import type { VoiceAttachment } from "./contract";
import {
  clock,
  createExclusive,
  isPlayedByOthers,
  playerInitial,
  playerReducer,
  seekPosition,
  shouldReportPlayed,
  showUnplayedDot,
  urlNeedsRefresh,
} from "./logic";
import { Waveform } from "./waveform";

/** One player at a time, across every bubble on the page. */
const exclusive = createExclusive();
const FLAT = new Array(64).fill(40);

/**
 * A voice message: play or pause, a waveform that fills as it plays (click or drag to seek, arrow keys
 * too), elapsed and total time, a 1x/1.5x/2x speed chip, an unplayed dot on other people's messages and a
 * blue mic on mine once someone played it. The signed URL is only requested on the first play and is
 * fetched again after it expires. `/played` is sent once, when someone else's message starts.
 */
export function VoiceBubble({ a, mine, meId, className }: { a: VoiceAttachment; mine: boolean; meId: string | undefined; className?: string }) {
  const duration = a.duration_secs ?? 1;
  const [s, dispatch] = useReducer(playerReducer, duration, playerInitial);
  const audio = useRef<HTMLAudioElement | null>(null);
  const fetchedAt = useRef<number | null>(null);
  const sent = useRef(false);
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const stateRef = useRef(s);
  useEffect(() => {
    stateRef.current = s;
  });

  const stop = useCallback(() => {
    audio.current?.pause();
    dispatch({ type: "pause" });
  }, []);

  const ensureAudio = useCallback(() => {
    if (audio.current) return audio.current;
    const el = new Audio();
    el.preload = "none";
    el.addEventListener("timeupdate", () => dispatch({ type: "time", secs: el.currentTime }));
    el.addEventListener("ended", () => {
      exclusive.release(a.id);
      dispatch({ type: "ended" });
    });
    el.addEventListener("error", () => {
      // An expired signed URL fails mid-play: drop the cache so the next play fetches a new one.
      fetchedAt.current = null;
      dispatch({ type: "fail", offline: typeof navigator !== "undefined" && navigator.onLine === false });
    });
    audio.current = el;
    return el;
  }, [a.id]);

  const play = useCallback(async () => {
    const el = ensureAudio();
    dispatch({ type: "play" });
    try {
      if (urlNeedsRefresh(fetchedAt.current, Date.now()) || !el.src) {
        const at = stateRef.current.position;
        const url = await fetchVoiceUrl(a.id);
        fetchedAt.current = Date.now();
        el.src = url;
        el.currentTime = at;
      }
      exclusive.claim(a.id, stop);
      el.playbackRate = stateRef.current.speed;
      await el.play();
      dispatch({ type: "ready" });
      if (shouldReportPlayed({ mine, playedBy: a.played_by ?? [], meId, alreadySent: sent.current })) {
        sent.current = true;
        void reportPlayed(a.id).catch(() => {
          sent.current = false;
        });
      }
    } catch {
      exclusive.release(a.id);
      fetchedAt.current = null;
      dispatch({ type: "fail", offline: typeof navigator !== "undefined" && navigator.onLine === false });
    }
  }, [a.id, a.played_by, ensureAudio, meId, mine, stop]);

  useEffect(
    () => () => {
      exclusive.release(a.id);
      const el = audio.current;
      if (el) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
    },
    [a.id],
  );

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = s.speed;
  }, [s.speed]);

  const seekTo = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    const t = seekPosition(clientX, r.left, r.width, duration);
    dispatch({ type: "seek", secs: t });
    if (audio.current?.src) audio.current.currentTime = t;
  };

  const playing = s.phase === "playing" || s.phase === "loading";
  const unplayed = showUnplayedDot({ mine, playedBy: a.played_by ?? [], meId });
  const heard = isPlayedByOthers({ mine, playedBy: a.played_by ?? [], meId });
  const failed = s.phase === "error" || s.phase === "offline";
  const label = `Voice message, ${clock(duration)}${unplayed ? ", unplayed" : ""}`;

  return (
    <div
      role="group"
      aria-label={label}
      data-testid="voice-bubble"
      className={cn("flex w-72 max-w-full items-center gap-2.5 rounded-lg border border-border bg-surface px-2.5 py-2", className)}
    >
      <button
        type="button"
        onClick={() => (playing ? stop() : void play())}
        aria-label={playing ? "Pause voice message" : failed ? "Retry voice message" : "Play voice message"}
        className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-fg-on-accent transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {s.phase === "loading" ? (
          <Spinner size={16} label="Loading voice message" />
        ) : playing ? (
          <Pause className="size-4" fill="currentColor" aria-hidden />
        ) : failed ? (
          <CircleAlert className="size-4" aria-hidden />
        ) : (
          <Play className="ml-0.5 size-4" fill="currentColor" aria-hidden />
        )}
        {unplayed && <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-green ring-2 ring-surface" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          ref={track}
          role="slider"
          tabIndex={0}
          aria-label="Seek voice message"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(s.position)}
          aria-valuetext={`${clock(s.position)} of ${clock(duration)}`}
          className="cursor-pointer touch-none rounded-xs py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            seekTo(e.clientX);
          }}
          onPointerMove={(e) => dragging.current && seekTo(e.clientX)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
          onKeyDown={(e) => {
            const step = e.key === "ArrowRight" ? 5 : e.key === "ArrowLeft" ? -5 : 0;
            if (!step) return;
            e.preventDefault();
            const t = Math.max(0, Math.min(duration, s.position + step));
            dispatch({ type: "seek", secs: t });
            if (audio.current?.src) audio.current.currentTime = t;
          }}
        >
          <Waveform bars={a.waveform ?? FLAT} progress={s.position / duration} />
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-11 tabular text-fg-muted">
          <span>
            {playing || s.position > 0 ? clock(s.position) : clock(duration)}
            {(playing || s.position > 0) && <span className="text-fg-faint"> / {clock(duration)}</span>}
          </span>
          {s.phase === "offline" && (
            <span className="inline-flex items-center gap-1 text-warning-text" role="status">
              <WifiOff className="size-3" aria-hidden /> Offline
            </span>
          )}
          {s.phase === "error" && (
            <span className="text-danger-text" role="status">
              Couldn&apos;t play. Tap to retry
            </span>
          )}
          <button
            type="button"
            onClick={() => dispatch({ type: "speed" })}
            aria-label={`Playback speed ${s.speed}x. Change speed`}
            className="ml-auto rounded-xs bg-active px-1.5 py-px text-11 font-medium text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
          >
            {s.speed}x
          </button>
          {mine && (
            <Mic
              className={cn("size-3.5", heard ? "text-info-text" : "text-fg-faint")}
              aria-label={heard ? "Played" : "Not played yet"}
              role="img"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/*
 * Pure rules for voice messages: the 64-bar waveform, mime choice, the recorder and player state
 * machines and the one-player-at-a-time rule. No React, no browser APIs, no "@/" imports, so
 * `npm test` runs it under node:test with explicit clocks and fakes.
 */

export const BARS = 64;
export const MIN_SECS = 1;
export const MAX_SECS = 300;
export const MAX_BYTES = 8 * 1024 * 1024;
export const VOICE_MIMES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/aac", "audio/mpeg"] as const;
export const SPEEDS = [1, 1.5, 2] as const;
export type Speed = (typeof SPEEDS)[number];

/* ---------- waveform ---------- */

/**
 * Reduce amplitude samples (0..1, or -1..1: the absolute value counts) to exactly 64 integers 0..255.
 * Each bar is the PEAK of its slice, so a short loud sound is not averaged away. Fewer samples than
 * bars repeat the nearest sample; no samples give 64 zeros.
 */
export function peakBars(samples: ArrayLike<number>, bars = BARS): number[] {
  const out = new Array<number>(bars).fill(0);
  const n = samples.length;
  if (n === 0) return out;
  for (let b = 0; b < bars; b++) {
    const from = Math.floor((b * n) / bars);
    const to = Math.max(from + 1, Math.floor(((b + 1) * n) / bars));
    let peak = 0;
    for (let i = from; i < Math.min(to, n); i++) {
      const v = Math.abs(samples[i] ?? 0);
      if (Number.isFinite(v) && v > peak) peak = v;
    }
    out[b] = Math.round(Math.min(1, peak) * 255);
  }
  return out;
}

/** Scale so the loudest bar reaches 255 (quiet voices still draw a readable shape). Silence stays flat. */
export function scaleToPeak(bars: readonly number[]): number[] {
  const max = Math.max(0, ...bars);
  if (max === 0) return [...bars];
  return bars.map((v) => Math.min(255, Math.round((v / max) * 255)));
}

export function isValidWaveform(w: unknown): w is number[] {
  return Array.isArray(w) && w.length === BARS && w.every((v) => Number.isInteger(v) && v >= 0 && v <= 255);
}

/** Height (0..1) of a bar for drawing; never fully flat so silence still reads as a bar. */
export function barHeight(v: number): number {
  return 0.12 + 0.88 * (Math.max(0, Math.min(255, v)) / 255);
}

/* ---------- mime and upload checks ---------- */

/** "audio/webm;codecs=opus" -> "audio/webm". */
export function baseMime(m: string): string {
  return m.split(";")[0]!.trim().toLowerCase();
}

/** Best supported recording format: WebM/Opus (Chrome, Firefox), else MP4 (Safari). Null when neither works. */
export function pickRecordingMime(isSupported: (m: string) => boolean): string | null {
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) if (isSupported(m)) return m;
  return null;
}

export function checkVoiceUpload(input: { mime: string; size: number; durationSecs: number; waveform: unknown }): string | null {
  if (!(VOICE_MIMES as readonly string[]).includes(baseMime(input.mime))) return "This browser recorded in a format we can't send.";
  if (input.size <= 0) return "The recording is empty.";
  if (input.size > MAX_BYTES) return "The recording is over 8 MB. Record a shorter message.";
  if (input.durationSecs < MIN_SECS) return "Too short to send.";
  if (input.durationSecs > MAX_SECS) return "Voice messages are limited to 5 minutes.";
  if (!isValidWaveform(input.waveform)) return "The recording could not be read.";
  return null;
}

/* ---------- formatting ---------- */

/** 83.4 -> "1:23". */
export function clock(secs: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(secs) ? secs : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Chat list preview and notification text. */
export function voiceLabel(durationSecs: number | null | undefined): string {
  return durationSecs && durationSecs > 0 ? `Voice message (${clock(durationSecs)})` : "Voice message";
}

/* ---------- recorder state machine ---------- */

export type RecorderPhase = "idle" | "requesting" | "recording" | "paused" | "denied" | "unsupported" | "error" | "done";
export type RecorderOutcome = "send" | "discarded" | "cancelled";

export type RecorderState = {
  phase: RecorderPhase;
  /** Recorded time before the current running segment. */
  accMs: number;
  /** When the running segment started (only while recording). */
  segStart: number | null;
  outcome: RecorderOutcome | null;
  autoStopped: boolean;
};

export type RecorderEvent =
  | { type: "unsupported" }
  | { type: "start" }
  | { type: "granted"; now: number }
  | { type: "denied" }
  | { type: "fail" }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number }
  | { type: "tick"; now: number }
  | { type: "stop"; now: number }
  | { type: "cancel" }
  | { type: "reset" };

export const recorderInitial: RecorderState = { phase: "idle", accMs: 0, segStart: null, outcome: null, autoStopped: false };

export function elapsedMs(s: RecorderState, now: number): number {
  const run = s.phase === "recording" && s.segStart !== null ? Math.max(0, now - s.segStart) : 0;
  return Math.min(MAX_SECS * 1000, s.accMs + run);
}

export function remainingSecs(s: RecorderState, now: number): number {
  return Math.max(0, Math.ceil((MAX_SECS * 1000 - elapsedMs(s, now)) / 1000));
}

/** Show the countdown in the last 30 seconds. */
export const COUNTDOWN_FROM_SECS = 30;

function finish(s: RecorderState, now: number, auto: boolean): RecorderState {
  const ms = elapsedMs(s, now);
  return { phase: "done", accMs: ms, segStart: null, outcome: ms >= MIN_SECS * 1000 ? "send" : "discarded", autoStopped: auto };
}

export function recorderReducer(s: RecorderState, e: RecorderEvent): RecorderState {
  switch (e.type) {
    case "unsupported":
      return { ...recorderInitial, phase: "unsupported" };
    case "start":
      return s.phase === "idle" || s.phase === "denied" || s.phase === "error" || s.phase === "done"
        ? { ...recorderInitial, phase: "requesting" }
        : s;
    case "granted":
      return s.phase === "requesting" ? { ...recorderInitial, phase: "recording", segStart: e.now } : s;
    case "denied":
      return s.phase === "requesting" ? { ...recorderInitial, phase: "denied" } : s;
    case "fail":
      return s.phase === "requesting" || s.phase === "recording" || s.phase === "paused" ? { ...recorderInitial, phase: "error" } : s;
    case "pause":
      return s.phase === "recording" ? { ...s, phase: "paused", accMs: elapsedMs(s, e.now), segStart: null } : s;
    case "resume":
      return s.phase === "paused" ? { ...s, phase: "recording", segStart: e.now } : s;
    case "tick":
      return s.phase === "recording" && elapsedMs(s, e.now) >= MAX_SECS * 1000 ? finish(s, e.now, true) : s;
    case "stop":
      return s.phase === "recording" || s.phase === "paused" ? finish(s, e.now, false) : s;
    case "cancel":
      // Cancel from any live phase (and when the tab hides or the component unmounts) releases everything.
      return s.phase === "recording" || s.phase === "paused" || s.phase === "requesting"
        ? { ...recorderInitial, phase: "idle", outcome: "cancelled" }
        : s;
    case "reset":
      return recorderInitial;
  }
}

/** True while a microphone stream should be open. The hook stops every track the moment this is false. */
export function micIsOpen(s: RecorderState): boolean {
  return s.phase === "requesting" || s.phase === "recording" || s.phase === "paused";
}

/* ---------- player state machine ---------- */

export type PlayerPhase = "idle" | "loading" | "playing" | "paused" | "error" | "offline";

export type PlayerState = {
  phase: PlayerPhase;
  position: number;
  duration: number;
  speed: Speed;
};

export type PlayerEvent =
  | { type: "play" }
  | { type: "ready" }
  | { type: "pause" }
  | { type: "time"; secs: number }
  | { type: "seek"; secs: number }
  | { type: "ended" }
  | { type: "fail"; offline: boolean }
  | { type: "speed" }
  | { type: "stop" };

export const playerInitial = (duration: number): PlayerState => ({ phase: "idle", position: 0, duration, speed: 1 });

export function nextSpeed(s: Speed): Speed {
  return SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]!;
}

const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(v) ? v : 0));

export function playerReducer(s: PlayerState, e: PlayerEvent): PlayerState {
  switch (e.type) {
    case "play":
      return s.phase === "playing" || s.phase === "loading" ? s : { ...s, phase: "loading", position: s.position >= s.duration ? 0 : s.position };
    case "ready":
      return s.phase === "loading" ? { ...s, phase: "playing" } : s;
    case "pause":
    case "stop":
      return s.phase === "playing" || s.phase === "loading" ? { ...s, phase: "paused" } : s;
    case "time":
      return s.phase === "playing" ? { ...s, position: clamp(e.secs, s.duration) } : s;
    case "seek":
      return { ...s, position: clamp(e.secs, s.duration) };
    case "ended":
      return { ...s, phase: "paused", position: 0 };
    case "fail":
      return { ...s, phase: e.offline ? "offline" : "error" };
    case "speed":
      return { ...s, speed: nextSpeed(s.speed) };
  }
}

/** Position (seconds) for a click or drag at `clientX` on a track starting at `left` with `width`. */
export function seekPosition(clientX: number, left: number, width: number, duration: number): number {
  if (width <= 0) return 0;
  return clamp(((clientX - left) / width) * duration, duration);
}

/** Signed URLs are short-lived: ask for a new one when the cached one has (nearly) expired. */
export function urlNeedsRefresh(fetchedAt: number | null, now: number, ttlMs = 45_000): boolean {
  return fetchedAt === null || now - fetchedAt >= ttlMs;
}

/** `/played` is sent once, only for someone else's message that this person has not already played. */
export function shouldReportPlayed(input: { mine: boolean; playedBy: readonly string[]; meId: string | undefined; alreadySent: boolean }): boolean {
  if (input.mine || input.alreadySent || !input.meId) return false;
  return !input.playedBy.includes(input.meId);
}

/** Unplayed dot: others' messages this person has not played. */
export function showUnplayedDot(input: { mine: boolean; playedBy: readonly string[]; meId: string | undefined }): boolean {
  return !input.mine && Boolean(input.meId) && !input.playedBy.includes(input.meId!);
}

/** "Played" (blue mic) on my own message once anyone else has played it. */
export function isPlayedByOthers(input: { mine: boolean; playedBy: readonly string[]; meId: string | undefined }): boolean {
  return input.mine && input.playedBy.some((u) => u !== input.meId);
}

/** Add a user to `played_by` once (realtime `voice.played`). */
export function withPlayed(playedBy: readonly string[], userId: string): string[] {
  return playedBy.includes(userId) ? [...playedBy] : [...playedBy, userId];
}

/* ---------- one player at a time ---------- */

export type Exclusive = { claim: (id: string, stop: () => void) => void; release: (id: string) => void; active: () => string | null };

export function createExclusive(): Exclusive {
  let cur: { id: string; stop: () => void } | null = null;
  return {
    claim(id, stop) {
      if (cur && cur.id !== id) cur.stop();
      cur = { id, stop };
    },
    release(id) {
      if (cur?.id === id) cur = null;
    },
    active: () => cur?.id ?? null,
  };
}

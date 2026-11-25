/* Pure rules for the screen recorder: caps, mime choice, naming. Unit tested. */

import { baseMime, MAX_MEDIA_BYTES } from "./limits.ts";

/** The API accepts duration_secs 1..600. */
export const MAX_RECORDING_SECS = 600;
/** The API caps video at 100 MB; stop a little early so the last chunk never tips it over. */
export const MAX_RECORDING_BYTES = MAX_MEDIA_BYTES - 4 * 1024 * 1024;
/*
 * Recorded at 720p (1280x720 at most), 20 fps. 2.5 Mbps would be about 190 MB for ten minutes, twice the API's
 * 100 MB video cap. 1.2 Mbps video plus 64 kbps audio is about 95 MB for ten minutes (about 6% under the byte cap
 * above), which is plenty for screen content at 720p, and lets the full ten minutes fit. The byte cap still stops
 * a recording that runs hot.
 */
export const VIDEO_BPS = 1_200_000;
export const AUDIO_BPS = 64_000;
export const MAX_WIDTH = 1280;
export const MAX_HEIGHT = 720;
export const FRAME_RATE = 20;
export const MAX_FRAME_RATE = 24;

/** getDisplayMedia video constraints: capped at 720p and a modest frame rate. */
export const VIDEO_CONSTRAINTS = {
  width: { ideal: MAX_WIDTH, max: MAX_WIDTH },
  height: { ideal: MAX_HEIGHT, max: MAX_HEIGHT },
  frameRate: { ideal: FRAME_RATE, max: MAX_FRAME_RATE },
} as const;

/** Preferred first. Every entry's base type is on the API's allow list. */
export const MIME_PREFERENCE = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=h264,opus",
  "video/webm",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4",
] as const;

/** First supported type from the preference list, or null when the browser supports none. */
export function pickRecordingMime(isSupported: (type: string) => boolean): string | null {
  return MIME_PREFERENCE.find((t) => isSupported(t)) ?? null;
}

/** The mime sent to the API and on the upload: no codec parameters. */
export function uploadMime(recorderType: string): string {
  return baseMime(recorderType) || "video/webm";
}

export type StopReason = "time" | "size" | null;

/** Whether recording must stop now, and why. */
export function capReached(elapsedMs: number, bytes: number): StopReason {
  if (elapsedMs >= MAX_RECORDING_SECS * 1000) return "time";
  if (bytes >= MAX_RECORDING_BYTES) return "size";
  return null;
}

/** Whole seconds for the API: at least 1, at most 600. */
export function durationSecs(elapsedMs: number): number {
  return Math.min(MAX_RECORDING_SECS, Math.max(1, Math.round(elapsedMs / 1000)));
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function extensionFor(mime: string): string {
  return baseMime(mime) === "video/mp4" ? "mp4" : "webm";
}

/** "Q3 walkthrough" + video/webm gives "Q3 walkthrough.webm", safe for the API's filename rules. */
export function recordingFilename(title: string, mime: string): string {
  const clean = title.replace(/[\\/\0]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "Screen recording";
  return `${clean}.${extensionFor(mime)}`;
}

export function limitMessage(reason: Exclude<StopReason, null>): string {
  return reason === "time"
    ? "Recording stopped at the 10 minute limit. What you captured is ready to review."
    : "Recording stopped at the 100 MB size limit. What you captured is ready to review.";
}

/** Why the recorder can't run here, or null when it can. Takes the environment so it can be tested. */
export function unsupportedReason(env: {
  hasDisplayMedia: boolean;
  hasMediaRecorder: boolean;
  userAgent: string;
  maxTouchPoints: number;
  platform: string;
}): string | null {
  const mobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(env.userAgent) || (env.platform === "MacIntel" && env.maxTouchPoints > 1);
  if (mobile) return "Screen recording needs a desktop browser. Phones and tablets can't share their screen to a web page.";
  if (!env.hasDisplayMedia || !env.hasMediaRecorder) {
    return "This browser can't record the screen. Use a current Chrome, Edge or Firefox on a computer.";
  }
  return null;
}

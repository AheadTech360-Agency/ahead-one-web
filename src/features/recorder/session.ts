/*
 * One screen capture, from permission prompt to blob. Plain TypeScript (no React) so cleanup is
 * easy to reason about: release() always stops every track, closes the audio graph and frees the mic.
 */

import { AUDIO_BPS, pickRecordingMime, uploadMime, VIDEO_BPS, VIDEO_CONSTRAINTS } from "@/lib/files/recording";

export type CaptureErrorKind = "denied" | "no-screen" | "mic-denied" | "no-mic" | "unsupported" | "failed";

export class CaptureError extends Error {
  readonly kind: CaptureErrorKind;
  constructor(kind: CaptureErrorKind, message: string) {
    super(message);
    this.name = "CaptureError";
    this.kind = kind;
  }
}

export type CaptureOptions = { voice: boolean; systemAudio: boolean };
export type CaptureResult = { blob: Blob; mime: string; durationMs: number; hasAudio: boolean };

const errName = (e: unknown) => (e instanceof DOMException || e instanceof Error ? e.name : "");

export class CaptureSession {
  private display: MediaStream | null = null;
  private mic: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mixed: MediaStream | null = null;
  private bytesSoFar = 0;
  private activeMs = 0;
  private runningSince: number | null = null;
  private done: Promise<CaptureResult> | null = null;
  hasAudio = false;
  /** Called when the user stops sharing from the browser's own bar. */
  onShareEnded: (() => void) | null = null;

  get bytes() {
    return this.bytesSoFar;
  }
  get elapsedMs() {
    return this.activeMs + (this.runningSince === null ? 0 : performance.now() - this.runningSince);
  }
  get state(): RecordingState | "inactive" {
    return this.recorder?.state ?? "inactive";
  }

  /** Ask for the screen (and the microphone). Must be called straight from a click. */
  async acquire(opts: CaptureOptions): Promise<void> {
    try {
      this.display = await navigator.mediaDevices.getDisplayMedia({
        video: VIDEO_CONSTRAINTS,
        audio: opts.systemAudio,
        // Chromium hints: keep the picker on tabs/windows we can show, and let the user switch surface.
        ...({ selfBrowserSurface: "include", surfaceSwitching: "include", systemAudio: opts.systemAudio ? "include" : "exclude" } as object),
      });
    } catch (e) {
      const n = errName(e);
      if (n === "NotAllowedError" || n === "SecurityError") throw new CaptureError("denied", "You didn't share a screen, window or tab, or the browser blocked it.");
      if (n === "NotFoundError") throw new CaptureError("no-screen", "There's nothing to capture on this device.");
      if (n === "NotSupportedError" || n === "TypeError") throw new CaptureError("unsupported", "This browser can't record the screen.");
      throw new CaptureError("failed", "Couldn't start the screen capture.");
    }

    if (opts.voice) {
      try {
        this.mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        });
      } catch (e) {
        this.release();
        const n = errName(e);
        if (n === "NotFoundError" || n === "OverconstrainedError") {
          throw new CaptureError("no-mic", "No microphone was found. Plug one in, or turn off Record my voice.");
        }
        throw new CaptureError("mic-denied", "The browser blocked the microphone. Allow it for this site, or turn off Record my voice.");
      }
    }

    const video = this.display.getVideoTracks()[0];
    video?.addEventListener("ended", () => this.onShareEnded?.(), { once: true });

    // Mix tab/system audio and the microphone into one track.
    const sources = [this.display, this.mic].filter((s): s is MediaStream => Boolean(s && s.getAudioTracks().length));
    const tracks: MediaStreamTrack[] = [...this.display.getVideoTracks()];
    if (sources.length) {
      this.ctx = new AudioContext();
      const dest = this.ctx.createMediaStreamDestination();
      for (const s of sources) this.ctx.createMediaStreamSource(s).connect(dest);
      tracks.push(...dest.stream.getAudioTracks());
      this.hasAudio = true;
    }
    this.mixed = new MediaStream(tracks);
  }

  /** Start recording. Returns the mime the recorder actually uses, with codecs. */
  start(): string {
    if (!this.mixed) throw new CaptureError("failed", "Nothing to record.");
    const type = pickRecordingMime((t) => MediaRecorder.isTypeSupported(t));
    if (!type) throw new CaptureError("unsupported", "This browser can't record in a format we accept (WebM or MP4).");
    this.recorder = new MediaRecorder(this.mixed, {
      mimeType: type,
      videoBitsPerSecond: VIDEO_BPS,
      audioBitsPerSecond: this.hasAudio ? AUDIO_BPS : undefined,
    });
    this.chunks = [];
    this.bytesSoFar = 0;
    this.activeMs = 0;
    const recorder = this.recorder;
    this.done = new Promise<CaptureResult>((resolve, reject) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size) {
          this.chunks.push(e.data);
          this.bytesSoFar += e.data.size;
        }
      };
      recorder.onerror = () => reject(new CaptureError("failed", "The recording failed."));
      recorder.onstop = () => {
        const durationMs = this.elapsedMs;
        const mime = uploadMime(recorder.mimeType || type);
        resolve({ blob: new Blob(this.chunks, { type: mime }), mime, durationMs, hasAudio: this.hasAudio });
      };
    });
    recorder.start(1000);
    this.runningSince = performance.now();
    return type;
  }

  pause() {
    if (this.recorder?.state !== "recording") return;
    this.recorder.pause();
    if (this.runningSince !== null) this.activeMs += performance.now() - this.runningSince;
    this.runningSince = null;
  }

  resume() {
    if (this.recorder?.state !== "paused") return;
    this.recorder.resume();
    this.runningSince = performance.now();
  }

  /** Stop and collect the result. Safe to call twice. Releases every device. */
  async stop(): Promise<CaptureResult> {
    const recorder = this.recorder;
    if (!recorder || !this.done) throw new CaptureError("failed", "Nothing was recorded.");
    if (recorder.state !== "inactive") {
      if (this.runningSince !== null) {
        this.activeMs += performance.now() - this.runningSince;
        this.runningSince = null;
      }
      recorder.stop();
    }
    try {
      return await this.done;
    } finally {
      this.release();
    }
  }

  /** Stop every track, close the audio graph and free the microphone. Idempotent. */
  release() {
    this.onShareEnded = null;
    for (const s of [this.display, this.mic, this.mixed]) s?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => {});
    this.display = this.mic = this.mixed = null;
    this.ctx = null;
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.ondataavailable = null;
      this.recorder.onstop = null;
      try {
        this.recorder.stop();
      } catch {
        // Already stopped.
      }
    }
  }
}

"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  BARS,
  elapsedMs,
  micIsOpen,
  peakBars,
  pickRecordingMime,
  recorderInitial,
  recorderReducer,
  scaleToPeak,
  type RecorderState,
} from "./logic";

export type RecordedVoice = { blob: Blob; mime: string; durationSecs: number; waveform: number[] };

export function voiceRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    pickRecordingMime((m) => MediaRecorder.isTypeSupported(m)) !== null
  );
}

/**
 * Records from the microphone with MediaRecorder, reads a live level from an AnalyserNode and keeps the
 * recorder state in the pure reducer (logic.ts). Every track is stopped and the audio context closed on
 * cancel, send, unmount and when the tab is hidden, so the browser's recording indicator always goes away.
 */
export function useVoiceRecorder(onRecorded: (v: RecordedVoice) => void) {
  const [state, dispatch] = useReducer(recorderReducer, recorderInitial);
  const [now, setNow] = useState(() => Date.now());
  const [live, setLive] = useState<number[]>([]);
  const stateRef = useRef<RecorderState>(state);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const chunks = useRef<Blob[]>([]);
  const peaks = useRef<number[]>([]);
  const raf = useRef(0);
  const mime = useRef("");
  const cb = useRef(onRecorded);
  const handled = useRef<RecorderState | null>(null);
  useEffect(() => {
    cb.current = onRecorded;
    stateRef.current = state;
  });

  const release = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (ctx.current && ctx.current.state !== "closed") void ctx.current.close().catch(() => {});
    ctx.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!voiceRecordingSupported()) {
      dispatch({ type: "unsupported" });
      return;
    }
    if (stateRef.current.phase === "requesting" || stateRef.current.phase === "recording" || stateRef.current.phase === "paused") return;
    stateRef.current = { ...stateRef.current, phase: "requesting" };
    dispatch({ type: "start" });
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      dispatch(name === "NotAllowedError" || name === "SecurityError" ? { type: "denied" } : { type: "fail" });
      return;
    }
    // Cancelled while the permission prompt was open: do not keep the microphone.
    if (stateRef.current.phase !== "requesting") {
      s.getTracks().forEach((t) => t.stop());
      return;
    }
    stream.current = s;
    const type = pickRecordingMime((m) => MediaRecorder.isTypeSupported(m))!;
    mime.current = type;
    chunks.current = [];
    peaks.current = [];
    try {
      const mr = new MediaRecorder(s, { mimeType: type });
      mr.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      mr.onerror = () => dispatch({ type: "fail" });
      mr.start(1000);
      rec.current = mr;
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new AC();
      ctx.current = ac;
      const an = ac.createAnalyser();
      an.fftSize = 1024;
      ac.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.fftSize);
      let last = 0;
      const loop = (t: number) => {
        raf.current = requestAnimationFrame(loop);
        if (stateRef.current.phase !== "recording") return;
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
        if (t - last >= 50) {
          last = t;
          peaks.current.push(peak);
          setLive((l) => [...l.slice(-47), peak]);
        }
        const n = Date.now();
        setNow(n);
        dispatch({ type: "tick", now: n });
      };
      raf.current = requestAnimationFrame(loop);
      dispatch({ type: "granted", now: Date.now() });
    } catch {
      release();
      dispatch({ type: "fail" });
    }
  }, [release]);

  const pause = useCallback(() => {
    if (rec.current?.state === "recording") rec.current.pause();
    dispatch({ type: "pause", now: Date.now() });
  }, []);
  const resume = useCallback(() => {
    if (rec.current?.state === "paused") rec.current.resume();
    dispatch({ type: "resume", now: Date.now() });
  }, []);
  const stop = useCallback(() => dispatch({ type: "stop", now: Date.now() }), []);
  const cancel = useCallback(() => dispatch({ type: "cancel" }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  // React to the reducer: close the microphone whenever it should be closed, hand over a finished take.
  useEffect(() => {
    if (micIsOpen(state)) return;
    const mr = rec.current;
    rec.current = null;
    if (!mr || mr.state === "inactive") {
      release();
      return;
    }
    if (state.phase === "done" && state.outcome === "send" && handled.current !== state) {
      handled.current = state;
      const ms = state.accMs;
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: mime.current });
        const waveform = scaleToPeak(peakBars(peaks.current, BARS));
        cb.current({ blob, mime: mime.current, durationSecs: Math.max(1, Math.round(ms / 1000)), waveform });
        chunks.current = [];
      };
    } else {
      mr.onstop = null;
      chunks.current = [];
    }
    try {
      mr.stop();
    } catch {
      // Already stopped.
    }
    release();
  }, [state, release]);

  // Release the microphone when the tab is hidden and on unmount.
  useEffect(() => {
    const onHide = () => document.hidden && dispatch({ type: "cancel" });
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      const mr = rec.current;
      rec.current = null;
      if (mr) mr.onstop = null;
      try {
        mr?.stop();
      } catch {
        // Already stopped.
      }
      release();
    };
  }, [release]);

  return { state, elapsed: elapsedMs(state, now), now, live, start, pause, resume, stop, cancel, reset };
}

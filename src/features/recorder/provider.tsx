"use client";

import { format } from "date-fns";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { errorMessage, isApiError } from "@/lib/api/client";
import type { Attachment, UploadTicket } from "@/lib/api/types";
import { capReached, durationSecs, limitMessage, recordingFilename, unsupportedReason, type StopReason } from "@/lib/files/recording";
import { useWorkspace } from "@/lib/workspace";
import { ConfirmDialog } from "@/ui/dialog";
import { toast } from "@/ui/toaster";
import { useAttachToTask, useInvalidateFiles, saveRecording } from "../files/api";
import { RecorderDialog } from "./dialog";
import { RecorderHud } from "./hud";
import { CaptureError, CaptureSession, type CaptureOptions } from "./session";

/** Where a finished recording should go. */
export type RecorderTarget =
  | { kind: "library" }
  | { kind: "task"; taskId: string; title: string }
  /** A chat composer: hand the file to the composer, which uploads it through the conversation flow. */
  | { kind: "chat"; label: string; onFile: (file: File) => void };

export type Phase = "closed" | "consent" | "starting" | "countdown" | "recording" | "paused" | "processing" | "review";

export type Review = {
  blob: Blob;
  url: string;
  mime: string;
  durationMs: number;
  hasAudio: boolean;
  stopReason: StopReason;
};

export type SaveState =
  | { status: "idle" }
  | { status: "saving"; progress: number }
  | { status: "saved"; attachment: Attachment }
  | { status: "error"; message: string };

export type AttachState =
  | { status: "idle" }
  | { status: "attaching" }
  | { status: "attached"; taskTitle: string }
  | { status: "error"; message: string };

type Support = { ok: true } | { ok: false; reason: string };

export type RecorderApi = {
  support: Support;
  phase: Phase;
  /** True from the moment capture is requested until the review is closed. */
  busy: boolean;
  open: (target?: RecorderTarget) => void;
};

type Internal = RecorderApi & {
  target: RecorderTarget;
  options: CaptureOptions;
  setOptions: (o: CaptureOptions) => void;
  systemAudioLikely: boolean;
  error: string | null;
  count: number;
  elapsedMs: number;
  review: Review | null;
  title: string;
  setTitle: (t: string) => void;
  save: SaveState;
  attach: AttachState;
  begin: () => void;
  close: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  requestDiscard: () => void;
  saveNow: () => void;
  attachTo: (taskId: string, taskTitle: string) => void;
};

const Ctx = createContext<Internal | null>(null);
const noop = () => () => {};

export function useRecorder(): RecorderApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRecorder must be used inside RecorderProvider");
  return v;
}

export function useRecorderInternal(): Internal {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRecorderInternal must be used inside RecorderProvider");
  return v;
}

function readSupport(): Support {
  const reason = unsupportedReason({
    hasDisplayMedia: Boolean(navigator.mediaDevices?.getDisplayMedia),
    hasMediaRecorder: typeof MediaRecorder !== "undefined",
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    platform: navigator.platform ?? "",
  });
  return reason ? { ok: false, reason } : { ok: true };
}

const SERVER_SUPPORT: Support = { ok: true };
let cachedSupport: Support | null = null;
function useSupport(): Support {
  return useSyncExternalStore(
    noop,
    () => (cachedSupport ??= readSupport()),
    () => SERVER_SUPPORT,
  );
}

function defaultTitle() {
  return `Screen recording, ${format(new Date(), "MMM d, h:mm a")}`;
}

/** Tab and system audio can only be captured by Chromium browsers on desktop. */
function useSystemAudioLikely() {
  return useSyncExternalStore(
    noop,
    () => "suppressLocalAudioPlayback" in (navigator.mediaDevices?.getSupportedConstraints?.() ?? {}),
    () => false,
  );
}

const LIBRARY: RecorderTarget = { kind: "library" };

export function RecorderProvider({ children }: { children: React.ReactNode }) {
  const { workspaceId } = useWorkspace();
  const invalidateFiles = useInvalidateFiles();
  const attachMutation = useAttachToTask(workspaceId);
  const support = useSupport();
  const systemAudioLikely = useSystemAudioLikely();

  const [phase, setPhase] = useState<Phase>("closed");
  const [target, setTarget] = useState<RecorderTarget>(LIBRARY);
  const [options, setOptions] = useState<CaptureOptions>({ voice: false, systemAudio: false });
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(3);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [review, setReview] = useState<Review | null>(null);
  const [title, setTitle] = useState("");
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [attach, setAttach] = useState<AttachState>({ status: "idle" });
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const session = useRef<CaptureSession | null>(null);
  const finishing = useRef(false);
  const ticket = useRef<UploadTicket | undefined>(undefined);
  const saveAbort = useRef<AbortController | null>(null);
  const reviewRef = useRef<Review | null>(null);
  const phaseRef = useRef<Phase>("closed");
  useEffect(() => {
    phaseRef.current = phase;
    reviewRef.current = review;
  });

  const resetAll = useCallback(() => {
    session.current?.release();
    session.current = null;
    saveAbort.current?.abort();
    saveAbort.current = null;
    ticket.current = undefined;
    finishing.current = false;
    setReview((r) => {
      if (r) URL.revokeObjectURL(r.url);
      return null;
    });
    setPhase("closed");
    setError(null);
    setElapsedMs(0);
    setCount(3);
    setSave({ status: "idle" });
    setAttach({ status: "idle" });
  }, []);

  // Free the screen and the microphone if the app unmounts mid-recording.
  useEffect(
    () => () => {
      session.current?.release();
      saveAbort.current?.abort();
      if (reviewRef.current) URL.revokeObjectURL(reviewRef.current.url);
    },
    [],
  );

  // Losing an unsaved recording to a refresh is easy; ask first.
  useEffect(() => {
    const unsaved = phase === "recording" || phase === "paused" || phase === "countdown" || (phase === "review" && save.status !== "saved");
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase, save.status]);

  const open = useCallback(
    (t: RecorderTarget = LIBRARY) => {
      if (support.ok === false) {
        toast.error("Screen recording isn't available here", { description: support.reason });
        return;
      }
      if (phaseRef.current !== "closed") return;
      setTarget(t);
      setError(null);
      setTitle(defaultTitle());
      setPhase("consent");
    },
    [support],
  );

  const finish = useCallback(async (reason: StopReason) => {
    const s = session.current;
    if (!s || finishing.current) return;
    finishing.current = true;
    setPhase("processing");
    try {
      const r = await s.stop();
      if (r.blob.size === 0) throw new CaptureError("failed", "The recording came out empty.");
      setReview({ blob: r.blob, url: URL.createObjectURL(r.blob), mime: r.mime, durationMs: r.durationMs, hasAudio: r.hasAudio, stopReason: reason });
      setSave({ status: "idle" });
      setAttach({ status: "idle" });
      setPhase("review");
      if (reason) toast.warning(limitMessage(reason));
    } catch (e) {
      toast.error("The recording didn't finish", { description: e instanceof CaptureError ? e.message : "Try recording again." });
      resetAll();
    } finally {
      session.current = null;
      finishing.current = false;
    }
  }, [resetAll]);

  const begin = useCallback(async () => {
    setError(null);
    setPhase("starting");
    const s = new CaptureSession();
    session.current = s;
    try {
      await s.acquire(options);
    } catch (e) {
      s.release();
      session.current = null;
      setError(e instanceof CaptureError ? e.message : "Couldn't start the capture.");
      setPhase("consent");
      return;
    }
    s.onShareEnded = () => {
      if (phaseRef.current === "countdown") {
        toast("Screen sharing stopped before recording began.");
        resetAll();
      } else void finish(null);
    };
    setCount(3);
    setPhase("countdown");
  }, [options, finish, resetAll]);

  const startRecording = useCallback(() => {
    try {
      session.current?.start();
      setElapsedMs(0);
      setPhase("recording");
    } catch (e) {
      toast.error("Couldn't start recording", { description: e instanceof CaptureError ? e.message : undefined });
      resetAll();
    }
  }, [resetAll]);

  // 3, 2, 1, then record.
  useEffect(() => {
    if (phase !== "countdown") return;
    const id = window.setTimeout(() => (count <= 1 ? startRecording() : setCount((c) => c - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [phase, count, startRecording]);

  // Timer and hard caps (ten minutes, about 100 MB).
  useEffect(() => {
    if (phase !== "recording" && phase !== "paused") return;
    const id = window.setInterval(() => {
      const s = session.current;
      if (!s) return;
      setElapsedMs(s.elapsedMs);
      const reason = capReached(s.elapsedMs, s.bytes);
      if (reason) void finish(reason);
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, finish]);

  const doAttach = useCallback(
    async (attachmentId: string, taskId: string, taskTitle: string) => {
      setAttach({ status: "attaching" });
      try {
        await attachMutation.mutateAsync({ attachmentId, taskId });
        setAttach({ status: "attached", taskTitle });
      } catch (e) {
        setAttach({ status: "error", message: errorMessage(e, "Couldn't attach it.") });
      }
    },
    [attachMutation],
  );

  const saveNow = useCallback(async () => {
    const r = reviewRef.current;
    if (!r || !workspaceId) return;
    const finalTitle = title.trim() || defaultTitle();
    if (target.kind === "chat") {
      target.onFile(new File([r.blob], recordingFilename(finalTitle, r.mime), { type: r.mime }));
      toast.success("Recording added to your message", { description: "Add a note if you like, then send." });
      resetAll();
      return;
    }
    const controller = new AbortController();
    saveAbort.current = controller;
    setSave({ status: "saving", progress: 0 });
    try {
      const attachment = await saveRecording(
        workspaceId,
        r.blob,
        { title: finalTitle, mime: r.mime, sizeBytes: r.blob.size, durationSecs: durationSecs(r.durationMs), hasAudio: r.hasAudio },
        {
          signal: controller.signal,
          ticket: ticket.current,
          onTicket: (t) => (ticket.current = t),
          onProgress: (p) => setSave({ status: "saving", progress: p }),
        },
      );
      ticket.current = undefined;
      setSave({ status: "saved", attachment });
      invalidateFiles(workspaceId);
      if (target.kind === "task") void doAttach(attachment.id, target.taskId, target.title);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const message =
        isApiError(e) && (e.status === 503 || e.code === "unavailable")
          ? "File storage isn't set up on this server yet, so recordings can't be saved. Download it instead."
          : errorMessage(e, "The upload didn't finish.");
      setSave({ status: "error", message });
    }
  }, [workspaceId, title, target, resetAll, invalidateFiles, doAttach]);

  const value = useMemo<Internal>(
    () => ({
      support,
      phase,
      busy: phase !== "closed",
      open,
      target,
      options,
      setOptions,
      systemAudioLikely,
      error,
      count,
      elapsedMs,
      review,
      title,
      setTitle,
      save,
      attach,
      begin: () => void begin(),
      close: () => {
        if (phase === "review" && save.status !== "saved") setConfirmDiscard(true);
        else resetAll();
      },
      stop: () => void finish(null),
      pause: () => {
        session.current?.pause();
        setPhase("paused");
      },
      resume: () => {
        session.current?.resume();
        setPhase("recording");
      },
      requestDiscard: () => (phase === "countdown" || phase === "consent" || phase === "starting" ? resetAll() : setConfirmDiscard(true)),
      saveNow: () => void saveNow(),
      attachTo: (taskId, taskTitle) => {
        const a = save.status === "saved" ? save.attachment : null;
        if (a) void doAttach(a.id, taskId, taskTitle);
      },
    }),
    [support, phase, open, target, options, systemAudioLikely, error, count, elapsedMs, review, title, save, attach, begin, finish, resetAll, saveNow, doAttach],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <RecorderDialog />
      <RecorderHud />
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this recording?"
        description="It hasn't been saved, so it will be gone for good."
        confirmLabel="Discard recording"
        onConfirm={() => {
          setConfirmDiscard(false);
          resetAll();
        }}
      />
    </Ctx.Provider>
  );
}

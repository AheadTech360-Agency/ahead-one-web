"use client";

import { CheckCircle2, CircleAlert, Download, Eye, Lock, Mic, MicOff, Monitor, RotateCw, Volume2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { durationSecs, formatClock, recordingFilename } from "@/lib/files/recording";
import { formatBytes } from "@/lib/files/limits";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Spinner } from "@/ui/spinner";
import { TaskPicker } from "../files/task-picker";
import { useRecorderInternal, type RecorderTarget } from "./provider";

function targetLine(t: RecorderTarget) {
  if (t.kind === "task") return `It attaches to the task “${t.title}” when you save.`;
  if (t.kind === "chat") return `It is added to your message in ${t.label}. Nothing is sent until you press send.`;
  return "It saves to Files. Only you can see it until you attach it to a task.";
}

export function RecorderDialog() {
  const r = useRecorderInternal();
  const open = r.phase === "consent" || r.phase === "starting" || r.phase === "review" || r.phase === "processing";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && (r.phase === "starting" || r.phase === "processing" ? undefined : r.close())}>
      {r.phase === "review" || r.phase === "processing" ? <Review /> : <Consent />}
    </Dialog>
  );
}

function Consent() {
  const r = useRecorderInternal();
  const starting = r.phase === "starting";
  return (
    <DialogContent
      title="Record your screen"
      description="Show a task, a bug or a walkthrough instead of typing it out. You choose exactly what is shared."
      size="md"
    >
      <DialogBody className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2.5 text-13 text-fg">
          <li className="flex gap-2.5">
            <Monitor className="mt-0.5 size-4 shrink-0 text-fg-faint" aria-hidden />
            <span>
              Your browser asks which <strong className="font-semibold">screen, window or tab</strong> to share. Only that is recorded, in 720p, up to 10 minutes.
            </span>
          </li>
          <li className="flex gap-2.5">
            <Eye className="mt-0.5 size-4 shrink-0 text-fg-faint" aria-hidden />
            <span>If you share your whole screen, anything that appears on it is captured, including notifications.</span>
          </li>
          <li className="flex gap-2.5">
            <Lock className="mt-0.5 size-4 shrink-0 text-fg-faint" aria-hidden />
            <span>{targetLine(r.target)}</span>
          </li>
        </ul>

        <fieldset className="flex flex-col gap-3 rounded-sm bg-surface-sunken p-3.5">
          <legend className="sr-only">Audio</legend>
          <Checkbox
            label="Record my voice"
            description="Uses your microphone. Off unless you turn it on."
            checked={r.options.voice}
            disabled={starting}
            onCheckedChange={(v) => r.setOptions({ ...r.options, voice: v === true })}
          />
          {r.systemAudioLikely ? (
            <Checkbox
              label="Include tab or system audio"
              description="Tick “Share audio” in the browser picker too. Works when you share a tab, and on some systems a whole screen."
              checked={r.options.systemAudio}
              disabled={starting}
              onCheckedChange={(v) => r.setOptions({ ...r.options, systemAudio: v === true })}
            />
          ) : (
            <p className="flex items-center gap-2 text-12 text-fg-muted">
              <Volume2 className="size-3.5 shrink-0" aria-hidden /> This browser can&apos;t share tab or system audio. Use Chrome or Edge for that.
            </p>
          )}
        </fieldset>

        {r.error && (
          <p role="alert" className="flex gap-2 rounded-sm bg-danger-subtle px-3 py-2 text-13 text-danger-text">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {r.error}
          </p>
        )}
        {starting && (
          <p role="status" className="flex items-center gap-2 text-13 text-fg-muted">
            <Spinner label="Waiting for the browser" /> Waiting for you to choose what to share.
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={r.close} disabled={starting}>
          Cancel
        </Button>
        <Button variant="primary" onClick={r.begin} loading={starting} data-testid="recorder-start">
          Choose screen and start
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Review() {
  const r = useRecorderInternal();
  const [picking, setPicking] = useState(false);
  const rev = r.review;
  if (r.phase === "processing" || !rev) {
    return (
      <DialogContent title="Finishing your recording" size="sm" hideClose>
        <DialogBody className="flex items-center gap-3 py-6 text-13 text-fg-muted">
          <Spinner label="Finishing" /> Wrapping up the video.
        </DialogBody>
      </DialogContent>
    );
  }
  const saving = r.save.status === "saving";
  const saved = r.save.status === "saved";
  const filename = recordingFilename(r.title || "Screen recording", rev.mime);
  const secs = durationSecs(rev.durationMs);

  return (
    <DialogContent
      title={saved ? "Recording saved" : "Review your recording"}
      description={saved ? undefined : "Watch it back, name it, then save. Nothing is uploaded until you do."}
      size="lg"
      onInteractOutside={(e) => e.preventDefault()}
    >
      <DialogBody className="flex flex-col gap-3.5">
        <video
          src={rev.url}
          controls
          preload="metadata"
          aria-label="Recording preview"
          data-testid="recording-preview"
          className="aspect-video max-h-[34vh] w-full rounded-sm bg-navy-deep object-contain"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-12 text-fg-muted tabular">
          <span>{formatClock(secs * 1000)} long</span>
          <span>{formatBytes(rev.blob.size)}</span>
          <span className="inline-flex items-center gap-1">
            {rev.hasAudio ? <Mic className="size-3.5" aria-hidden /> : <MicOff className="size-3.5" aria-hidden />}
            {rev.hasAudio ? "With sound" : "No sound"}
          </span>
        </div>
        {rev.stopReason && (
          <p className="rounded-sm bg-warning-subtle px-3 py-2 text-13 text-warning-text">
            {rev.stopReason === "time" ? "It reached the 10 minute limit and stopped." : "It reached the 100 MB size limit and stopped."}
          </p>
        )}
        <label className="flex flex-col gap-1.5 text-13 font-medium text-fg">
          Title
          <Input
            value={r.title}
            maxLength={120}
            disabled={saving || saved}
            onChange={(e) => r.setTitle(e.target.value)}
            data-testid="recording-title"
          />
        </label>

        {r.save.status === "idle" && r.target.kind !== "chat" && (
          <p className="flex items-center gap-2 text-12 text-fg-muted">
            <Lock className="size-3.5 shrink-0" aria-hidden /> {targetLine(r.target)}
          </p>
        )}
        {r.save.status === "saving" && (
          <div className="flex flex-col gap-1.5" role="status">
            <div
              role="progressbar"
              aria-label="Upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(r.save.progress * 100)}
              className="h-1.5 w-full overflow-hidden rounded-full bg-active"
            >
              <div className="h-full bg-green transition-[width] duration-[var(--dur-base)]" style={{ width: `${Math.max(3, r.save.progress * 100)}%` }} />
            </div>
            <p className="text-12 text-fg-muted tabular">Uploading {Math.round(r.save.progress * 100)}%. Keep this window open.</p>
          </div>
        )}
        {r.save.status === "error" && (
          <p role="alert" className="flex gap-2 rounded-sm bg-danger-subtle px-3 py-2 text-13 text-danger-text">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {r.save.message}
          </p>
        )}
        {saved && (
          <div className="flex flex-col gap-3 rounded-sm bg-success-subtle p-3.5">
            <p className="flex items-start gap-2 text-13 text-success-text">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span data-testid="recording-saved">
                Saved to{" "}
                <Link href="/files?source=recordings" className="font-semibold underline underline-offset-2" onClick={r.close}>
                  Files
                </Link>
                . {r.attach.status === "attached" ? `Attached to “${r.attach.taskTitle}”, so people on the project can watch it.` : "Only you can see it until you attach it to a task."}
              </span>
            </p>
            {r.attach.status === "attaching" && (
              <p role="status" className="flex items-center gap-2 text-13 text-fg-muted">
                <Spinner label="Attaching" /> Attaching to the task.
              </p>
            )}
            {r.attach.status === "error" && (
              <p role="alert" className="text-13 text-danger-text">
                {r.attach.message} The recording is still saved in Files.
              </p>
            )}
            {r.attach.status !== "attached" && r.attach.status !== "attaching" && (
              <>
                {r.target.kind === "task" ? (
                  <div>
                    <Button size="sm" onClick={() => r.target.kind === "task" && r.attachTo(r.target.taskId, r.target.title)}>
                      <RotateCw aria-hidden /> Try attaching again
                    </Button>
                  </div>
                ) : picking ? (
                  <TaskPicker
                    autoFocus
                    onPick={(t) => {
                      setPicking(false);
                      r.attachTo(t.id, t.title);
                    }}
                  />
                ) : (
                  <div>
                    <Button size="sm" variant="secondary" onClick={() => setPicking(true)} data-testid="recording-attach">
                      Attach to a task
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </DialogBody>
      <DialogFooter className={cn("flex-wrap", saved ? "justify-between" : "justify-end")}>
        {!saved && (
          <Button variant="ghost" onClick={r.close} disabled={saving} className="mr-auto">
            Discard
          </Button>
        )}
        <Button variant="secondary" asChild>
          <a href={rev.url} download={filename}>
            <Download aria-hidden /> Download
          </a>
        </Button>
        {saved ? (
          <Button variant="primary" onClick={r.close}>
            Done
          </Button>
        ) : (
          <Button variant="primary" onClick={r.saveNow} loading={saving} data-testid="recording-save">
            {r.save.status === "error" ? "Retry upload" : r.target.kind === "chat" ? "Add to message" : r.target.kind === "task" ? "Save and attach" : "Save recording"}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}

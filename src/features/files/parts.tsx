"use client";

import { AtSign, CheckSquare, Clock, File as FileIcon, FileArchive, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Hash, Lock, Mic, Video } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { Attachment, FileItem, FileSource } from "@/lib/api/types";
import { expiryLabel, expiryState } from "@/lib/files/files-query";
import { formatClock } from "@/lib/files/recording";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/ui/tooltip";

const noop = () => () => {};
/** Current time, stable within a minute, safe to read during render. */
export function useNow(): number {
  return useSyncExternalStore(noop, () => Math.floor(Date.now() / 60_000) * 60_000, () => 0);
}

/** The icon for a mime type. A component (not a lookup) so it can be used straight in JSX. */
export function FileGlyph({ mime, className, strokeWidth }: { mime: string; className?: string; strokeWidth?: number }) {
  const p = { className, strokeWidth, "aria-hidden": true as const };
  if (mime.startsWith("image/")) return <FileImage {...p} />;
  if (mime.startsWith("video/")) return <FileVideo {...p} />;
  if (mime.startsWith("audio/")) return <FileAudio {...p} />;
  if (mime === "application/zip" || mime === "application/x-7z-compressed") return <FileArchive {...p} />;
  if (mime.includes("sheet") || mime.includes("excel") || mime === "text/csv") return <FileSpreadsheet {...p} />;
  if (mime === "application/pdf" || mime.includes("word") || mime.startsWith("text/")) return <FileText {...p} />;
  return <FileIcon {...p} />;
}

export function FileTypeTile({ a, className }: { a: Attachment; className?: string }) {
  const recording = a.kind === "recording";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-sm",
        recording ? "bg-band text-band-fg" : "bg-surface-sunken text-fg-muted",
        className,
      )}
    >
      {recording ? <Video className="size-[18px]" strokeWidth={1.75} /> : <FileGlyph mime={a.mime} className="size-[18px]" strokeWidth={1.75} />}
    </span>
  );
}

/** Whether a file can be played or previewed in the dialog (video, audio, images). */
export function isPlayable(mime: string) {
  return mime.startsWith("video/") || mime.startsWith("audio/") || mime.startsWith("image/");
}

export function sourceHref(s: FileSource): string | null {
  if (!s.id) return null;
  if (s.kind === "task") return `/t/${s.id}`;
  if (s.kind === "channel" || s.kind === "dm") return `/messages/${s.id}`;
  return null;
}

const SOURCE_ICON = { task: CheckSquare, channel: Hash, dm: AtSign, recording: Video } as const;
const SOURCE_NAME = { task: "Task", channel: "Channel", dm: "Direct message", recording: "Recording" } as const;

export function SourceLabel({ s, className }: { s: FileSource; className?: string }) {
  const Icon = SOURCE_ICON[s.kind];
  // Channel names already arrive as "#name"; show them as-is.
  const sub = s.kind === "recording" ? "Only you, not attached" : s.project_name ? s.project_name : SOURCE_NAME[s.kind];
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <Icon className="size-3.5 shrink-0 text-fg-faint" aria-hidden />
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-13 text-fg">{s.name}</span>
          {s.is_private && (
            <Tooltip content={s.kind === "dm" ? "Direct message: only its members can see this file" : "Locked: only members can see this file"}>
              <span className="inline-flex shrink-0 text-fg-muted" tabIndex={0} role="img" aria-label={s.kind === "dm" ? "Private, direct message" : "Private, locked channel"}>
                <Lock className="size-3" aria-hidden />
              </span>
            </Tooltip>
          )}
        </span>
        <span className="block truncate text-12 text-fg-muted">{sub}</span>
      </span>
    </span>
  );
}

export const EXPIRY_TIP = "Files nobody opens for 90 days are deleted. Opening or downloading resets this.";

export function ExpiryBadge({ expiresAt, className }: { expiresAt: string; className?: string }) {
  const now = useNow();
  if (!now) return null;
  const { days, soon } = expiryState(expiresAt, now);
  const label = expiryLabel(days);
  return (
    <Tooltip content={EXPIRY_TIP}>
      <span
        tabIndex={0}
        aria-label={`${label}. ${EXPIRY_TIP}`}
        data-soon={soon}
        className={cn(
          "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-xs px-1.5 text-12 tabular outline-none focus-visible:outline-2 focus-visible:outline-ring",
          soon ? "bg-warning-subtle font-medium text-warning-text" : "text-fg-muted",
          className,
        )}
      >
        {soon && <Clock className="size-3" aria-hidden />}
        {soon ? label : days >= 60 ? `In ${Math.round(days / 30)} months` : `In ${days} days`}
      </span>
    </Tooltip>
  );
}

export function RecordingMeta({ a, className }: { a: Attachment; className?: string }) {
  if (a.kind !== "recording") return null;
  return (
    <span className={cn("inline-flex items-center gap-2 text-12 text-fg-muted tabular", className)}>
      {a.duration_secs ? <span>{formatClock(a.duration_secs * 1000)}</span> : null}
      {a.has_audio ? (
        <span className="inline-flex items-center" title="Has sound">
          <Mic className="size-3.5" aria-hidden />
          <span className="sr-only">With sound</span>
        </span>
      ) : null}
    </span>
  );
}

export type { FileItem };

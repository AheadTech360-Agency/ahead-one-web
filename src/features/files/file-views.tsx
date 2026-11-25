"use client";

import { Download, ExternalLink, MoreHorizontal, Mic, Paperclip, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import type { FileItem } from "@/lib/api/types";
import { formatBytes } from "@/lib/files/limits";
import { formatClock } from "@/lib/files/recording";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/ui/menu";
import { IconButton } from "@/ui/icon-button";
import { absoluteTime, relativeTime } from "../tasks/lib/dates";
import type { FileActions } from "./file-actions";
import { ExpiryBadge, FileTypeTile, isPlayable, RecordingMeta, SourceLabel, sourceHref } from "./parts";

const isUnattached = (f: FileItem) => f.source.kind === "recording";

export function FileMenu({ f, actions }: { f: FileItem; actions: FileActions }) {
  const a = f.attachment;
  const href = sourceHref(f.source);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={`Actions for ${a.filename}`} size="sm" noTooltip>
          <MoreHorizontal aria-hidden />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => actions.open(a)}>
          {isPlayable(a.mime) ? <Play aria-hidden /> : <Download aria-hidden />} {isPlayable(a.mime) ? "Open" : "Download"}
        </DropdownMenuItem>
        {isPlayable(a.mime) && (
          <DropdownMenuItem onSelect={() => actions.download(a)}>
            <Download aria-hidden /> Download
          </DropdownMenuItem>
        )}
        {href && (
          <DropdownMenuItem asChild>
            <Link href={href}>
              <ExternalLink aria-hidden /> Go to {f.source.kind === "task" ? "task" : "conversation"}
            </Link>
          </DropdownMenuItem>
        )}
        {isUnattached(f) && (
          <DropdownMenuItem onSelect={() => actions.askAttach(a)}>
            <Paperclip aria-hidden /> Attach to task
          </DropdownMenuItem>
        )}
        {f.can_delete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onSelect={() => actions.askDelete(f)}>
              <Trash2 aria-hidden /> Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NameButton({ f, actions, className }: { f: FileItem; actions: FileActions; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => actions.open(f.attachment)}
      title={isPlayable(f.attachment.mime) ? `Open ${f.attachment.filename}` : `Download ${f.attachment.filename}`}
      className={cn("block max-w-full truncate rounded-xs text-left text-13 font-medium text-fg hover:underline focus-visible:outline-2 focus-visible:outline-ring", className)}
    >
      {f.attachment.filename}
    </button>
  );
}

export const ROW_GRID = "md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.7fr)_72px_minmax(0,1fr)_84px_116px_32px] md:items-center md:gap-4";

export function FilesHeader() {
  return (
    <div aria-hidden className={cn("hidden border-b border-border px-2 pb-2 text-12 font-medium text-fg-muted", ROW_GRID)}>
      <span>Name</span>
      <span>Source</span>
      <span>Size</span>
      <span>Uploaded by</span>
      <span>Added</span>
      <span>Expires</span>
      <span />
    </div>
  );
}

export function FileRow({ f, actions }: { f: FileItem; actions: FileActions }) {
  const a = f.attachment;
  const uploader = a.uploader;
  return (
    <li className={cn("group/row flex flex-col gap-1.5 rounded-sm px-2 py-2.5 hover:bg-surface-sunken md:py-2", ROW_GRID)} data-testid="file-row">
      <div className="flex min-w-0 items-center gap-3">
        <FileTypeTile a={a} />
        <div className="min-w-0 flex-1">
          <NameButton f={f} actions={actions} />
          <RecordingMeta a={a} />
        </div>
        <span className="md:hidden">
          <FileMenu f={f} actions={actions} />
        </span>
      </div>
      <SourceLabel s={f.source} className="pl-12 md:pl-0" />
      <span className="hidden text-12 text-fg-muted tabular md:block">{formatBytes(a.size_bytes)}</span>
      <span className="hidden min-w-0 items-center gap-2 md:flex">
        {uploader ? (
          <>
            <Avatar user={uploader} size="xs" decorative />
            <span className="truncate text-13 text-fg">{uploader.full_name || uploader.email}</span>
          </>
        ) : (
          <span className="text-13 text-fg-muted">Removed user</span>
        )}
      </span>
      <span className="hidden text-12 text-fg-muted md:block" title={absoluteTime(a.created_at)}>
        {relativeTime(a.created_at)}
      </span>
      <div className="flex items-center gap-3 pl-12 text-12 text-fg-muted tabular md:block md:pl-0">
        <span className="md:hidden">
          {formatBytes(a.size_bytes)}, {relativeTime(a.created_at)}
        </span>
        <ExpiryBadge expiresAt={f.expires_at} />
      </div>
      <span className="hidden md:block">
        <FileMenu f={f} actions={actions} />
      </span>
    </li>
  );
}

/** A card for the grid view and the Recordings tab: no thumbnail, just a navy plate with a play mark. */
export function FileCard({ f, actions }: { f: FileItem; actions: FileActions }) {
  const a = f.attachment;
  const recording = a.kind === "recording";
  const playable = isPlayable(a.mime);
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-md border border-border bg-surface" data-testid="file-card">
      <button
        type="button"
        onClick={() => actions.open(a)}
        aria-label={`${playable ? "Open" : "Download"} ${a.filename}`}
        className={cn(
          "group/plate relative flex h-28 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
          recording ? "bg-band text-band-fg" : "bg-surface-sunken text-fg-muted",
        )}
      >
        <span
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-full transition-transform duration-[var(--dur-fast)] motion-safe:group-hover/plate:scale-105",
            recording ? "bg-green text-navy-deep" : "bg-surface text-fg",
          )}
        >
          {playable ? <Play className="size-[18px]" fill="currentColor" aria-hidden /> : <Download className="size-[18px]" aria-hidden />}
        </span>
        {recording && a.duration_secs ? (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-xs bg-navy-deep/80 px-1.5 py-0.5 text-12 tabular text-band-fg">
            {a.has_audio && <Mic className="size-3" aria-label="Has sound" />}
            {formatClock(a.duration_secs * 1000)}
          </span>
        ) : null}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <NameButton f={f} actions={actions} />
            <p className="truncate text-12 text-fg-muted tabular" title={absoluteTime(a.created_at)}>
              {a.uploader ? a.uploader.full_name || a.uploader.email : "Removed user"}, {relativeTime(a.created_at)}, {formatBytes(a.size_bytes)}
            </p>
          </div>
          <FileMenu f={f} actions={actions} />
        </div>
        <SourceLabel s={f.source} />
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <ExpiryBadge expiresAt={f.expires_at} />
          {isUnattached(f) && (
            <Button size="sm" variant="secondary" className="ml-auto" onClick={() => actions.askAttach(a)}>
              <Paperclip aria-hidden /> Attach to task
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

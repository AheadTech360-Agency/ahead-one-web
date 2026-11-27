"use client";

import { Download, Play, FileArchive, FileSpreadsheet, FileText, FileVideo, File as FileIcon, ImageOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import type { Attachment } from "@/lib/api/types";
import { useWorkspace } from "@/lib/workspace";
import { asVoice, VOICE_ENABLED } from "@/features/voice/contract";
import { VoiceBubble } from "@/features/voice/voice-bubble";
import { cn } from "@/lib/utils";
import { toast } from "@/ui/toaster";
import { MediaPlayer } from "@/features/files/media-player";
import { RecordingMeta } from "@/features/files/parts";
import { fetchAttachmentUrl, useAttachmentUrl } from "./api";
import { displayName, formatBytes, parseBody, type People } from "./format";

/** Message text with @mention chips and clickable links. Whitespace and newlines are kept. */
export function MessageText({
  body,
  people,
  meId,
  className,
  edited,
}: {
  body: string;
  people: People;
  meId?: string;
  className?: string;
  edited?: boolean;
}) {
  const parts = parseBody(body);
  return (
    <p className={cn("whitespace-pre-wrap break-words [overflow-wrap:anywhere]", className)}>
      {parts.map((p, i) => {
        if (p.kind === "text") return <span key={i}>{p.text}</span>;
        if (p.kind === "link") {
          return (
            <a
              key={i}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-accent-text underline decoration-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:decoration-current"
            >
              {p.text}
            </a>
          );
        }
        const u = people.get(p.id);
        const isMe = p.id === meId;
        return (
          <span
            key={i}
            className={cn(
              "rounded-xs px-0.5 font-medium",
              isMe ? "bg-warning-subtle text-warning-text" : "bg-accent-subtle text-accent-text",
            )}
          >
            @{u ? displayName(u) : "unknown"}
          </span>
        );
      })}
      {edited && <span className="ml-1 align-baseline text-11 text-fg-faint">(edited)</span>}
    </p>
  );
}

function FileTypeIcon({ mime }: { mime: string }) {
  const cls = "size-4";
  if (mime.startsWith("video/")) return <FileVideo className={cls} aria-hidden />;
  if (mime === "application/zip") return <FileArchive className={cls} aria-hidden />;
  if (mime.includes("sheet") || mime.includes("excel") || mime === "text/csv") return <FileSpreadsheet className={cls} aria-hidden />;
  if (mime === "application/pdf" || mime.startsWith("text/") || mime.includes("word")) return <FileText className={cls} aria-hidden />;
  return <FileIcon className={cls} aria-hidden />;
}

async function download(a: Attachment) {
  try {
    const { url } = await fetchAttachmentUrl(a.id);
    // The signed URL forces Content-Disposition: attachment, so this downloads in place.
    window.location.assign(url);
  } catch (e) {
    toast.error(`Couldn't download ${a.filename}`, { description: errorMessage(e) });
  }
}

/** Load the preview only once it scrolls near view: signed URLs are short-lived. */
function useNearView<T extends Element>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setNear(true),
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near] as const;
}

function ImagePreview({ a }: { a: Attachment }) {
  const [ref, near] = useNearView<HTMLButtonElement>();
  const q = useAttachmentUrl(a.id, near);
  const [failed, setFailed] = useState(false);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => void download(a)}
      aria-label={`Download ${a.filename}`}
      title={a.filename}
      className="group/img relative block h-48 w-72 max-w-full overflow-hidden rounded-md border border-border bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {q.data && !failed ? (
        // Signed, short-lived storage URL: next/image can't optimise it.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={q.data.url}
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
          loading="lazy"
        />
      ) : (
        <span className="flex size-full items-center justify-center text-fg-faint">
          {failed || q.isError ? <ImageOff className="size-5" aria-hidden /> : null}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-[color-mix(in_srgb,var(--surface-raised)_92%,transparent)] px-2 py-1 text-11 text-fg-muted opacity-0 transition-opacity duration-[var(--dur-fast)] group-hover/img:opacity-100 group-focus-visible/img:opacity-100">
        <span className="min-w-0 flex-1 truncate text-left">{a.filename}</span>
        <Download className="size-3.5 shrink-0" aria-hidden />
      </span>
    </button>
  );
}

function FileCard({ a }: { a: Attachment }) {
  return (
    <button
      type="button"
      onClick={() => void download(a)}
      className="group/file flex h-12 w-72 max-w-full items-center gap-2.5 rounded-md border border-border bg-surface px-2.5 text-left hover:border-border-strong hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex size-6 shrink-0 items-center justify-center text-fg-muted">
        <FileTypeIcon mime={a.mime} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-13 font-medium text-fg">{a.filename}</span>
        <span className="block text-11 text-fg-faint tabular">{formatBytes(a.size_bytes)}</span>
      </span>
      <Download className="size-4 shrink-0 text-fg-faint group-hover/file:text-fg" aria-hidden />
      <span className="sr-only">Download</span>
    </button>
  );
}

/**
 * Video and audio play in place. The signed URL is only requested on click: opening a file restarts its
 * retention clock, so scrolling past a message must not.
 */
function MediaCard({ a }: { a: Attachment }) {
  const [playing, setPlaying] = useState(false);
  const video = a.mime.startsWith("video/");
  if (playing) {
    return (
      <div className="flex w-full max-w-[480px] flex-col gap-1">
        <MediaPlayer a={a} autoPlay />
        <span className="flex items-center gap-2 text-11 text-fg-faint tabular">
          <span className="min-w-0 truncate">{a.filename}</span>
          <span>{formatBytes(a.size_bytes)}</span>
          <RecordingMeta a={a} />
          <button type="button" onClick={() => void download(a)} className="ml-auto inline-flex items-center gap-1 text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-ring">
            <Download className="size-3" aria-hidden /> Download
          </button>
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play ${a.filename}`}
      data-testid="chat-media"
      className="group/media flex h-14 w-72 max-w-full items-center gap-3 overflow-hidden rounded-md border border-border bg-surface pr-3 text-left hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className={cn("flex h-full w-14 shrink-0 items-center justify-center", a.kind === "recording" ? "bg-band text-band-fg" : "bg-surface-sunken text-fg-muted")}>
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-green text-navy-deep transition-transform duration-[var(--dur-fast)] motion-safe:group-hover/media:scale-105">
          <Play className="size-3.5" fill="currentColor" aria-hidden />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-13 font-medium text-fg">{a.filename}</span>
        <span className="flex items-center gap-2 text-11 text-fg-faint tabular">
          {video ? "Video" : "Audio"}, {formatBytes(a.size_bytes)}
          <RecordingMeta a={a} />
        </span>
      </span>
    </button>
  );
}

export function Attachments({ items }: { items: Attachment[] }) {
  const { me } = useWorkspace();
  if (items.length === 0) return null;
  const voices = VOICE_ENABLED ? items.flatMap((a) => (asVoice(a) ? [asVoice(a)!] : [])) : [];
  if (voices.length === items.length) {
    return (
      <div className="mt-1.5 flex flex-col gap-1.5">
        {voices.map((v) => (
          <VoiceBubble key={v.id} a={v} mine={v.uploader?.id === me?.user.id} />
        ))}
      </div>
    );
  }
  const images = items.filter((a) => a.mime.startsWith("image/"));
  const media = items.filter((a) => a.mime.startsWith("video/") || a.mime.startsWith("audio/"));
  const files = items.filter((a) => !a.mime.startsWith("image/") && !a.mime.startsWith("video/") && !a.mime.startsWith("audio/"));
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.map((a) => (
            <ImagePreview key={a.id} a={a} />
          ))}
        </div>
      )}
      {media.map((a) => (
        <MediaCard key={a.id} a={a} />
      ))}
      {files.map((a) => (
        <FileCard key={a.id} a={a} />
      ))}
    </div>
  );
}

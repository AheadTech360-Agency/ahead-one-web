"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleAlert, Download, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import type { Attachment } from "@/lib/api/types";
import { formatBytes } from "@/lib/files/limits";
import { Button } from "@/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/ui/dialog";
import { Spinner } from "@/ui/spinner";
import { downloadFile, fetchDownloadUrl } from "./api";
import { RecordingMeta } from "./parts";

type MediaLike = Pick<Attachment, "id" | "filename" | "mime">;

/**
 * Plays a video or audio file (or shows an image) from a signed URL. The signed URL only lives 60 s, so
 * when the element errors mid-play (a seek after expiry) a fresh one is fetched and playback resumes at
 * the same spot. Nothing is requested until this mounts, because opening a file resets its retention clock.
 */
export function MediaPlayer({ a, autoPlay, className }: { a: MediaLike; autoPlay?: boolean; className?: string }) {
  const q = useQuery({
    queryKey: ["file-inline", a.id],
    queryFn: ({ signal }) => fetchDownloadUrl(a.id, true, signal),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const el = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const resume = useRef<{ t: number; play: boolean } | null>(null);
  const [failures, setFailures] = useState(0);
  const url = q.data?.url;

  useEffect(() => {
    const m = el.current;
    const r = resume.current;
    if (!m || !r || !url) return;
    resume.current = null;
    const onMeta = () => {
      m.currentTime = r.t;
      if (r.play) void m.play().catch(() => {});
    };
    m.addEventListener("loadedmetadata", onMeta, { once: true });
    return () => m.removeEventListener("loadedmetadata", onMeta);
  }, [url]);

  function onMediaError() {
    const m = el.current;
    if (failures >= 3) return;
    setFailures((n) => n + 1);
    if (m) resume.current = { t: m.currentTime, play: !m.paused };
    void q.refetch();
  }

  if (q.isPending) {
    return (
      <div role="status" className={className ?? "flex aspect-video w-full items-center justify-center rounded-sm bg-surface-sunken"}>
        <Spinner size={20} label="Loading media" />
      </div>
    );
  }
  if (q.isError || !url || failures >= 3) {
    return (
      <div role="alert" className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-sm bg-surface-sunken p-4 text-center">
        <CircleAlert className="size-5 text-danger-text" aria-hidden />
        <p className="text-13 text-fg-muted">{q.isError ? errorMessage(q.error) : "This file couldn't be played."}</p>
        <Button
          size="sm"
          onClick={() => {
            setFailures(0);
            void q.refetch();
          }}
        >
          <RotateCw aria-hidden /> Try again
        </Button>
      </div>
    );
  }
  if (a.mime.startsWith("image/")) {
    // Signed, short-lived storage URL: next/image can't optimise it.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={a.filename} className="max-h-[60vh] w-full rounded-sm bg-surface-sunken object-contain" />;
  }
  if (a.mime.startsWith("audio/")) {
    return <audio ref={el} src={url} controls autoPlay={autoPlay} onError={onMediaError} className="w-full" aria-label={a.filename} />;
  }
  return (
    <video
      ref={el}
      src={url}
      controls
      autoPlay={autoPlay}
      playsInline
      onError={onMediaError}
      aria-label={a.filename}
      data-testid="media-video"
      className={className ?? "aspect-video w-full rounded-sm bg-navy-deep"}
    />
  );
}

/** A dialog player for any file the Files view or a task shows. */
export function PlayerDialog({ a, onOpenChange }: { a: Attachment | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={Boolean(a)} onOpenChange={onOpenChange}>
      {a && (
        <DialogContent title={a.filename} description={undefined} size="lg">
          <DialogBody className="flex flex-col gap-3">
            <MediaPlayer a={a} autoPlay={!a.mime.startsWith("image/")} />
            <p className="flex flex-wrap items-center gap-x-3 text-12 text-fg-muted tabular">
              <span>{formatBytes(a.size_bytes)}</span>
              {a.uploader && <span>{a.uploader.full_name || a.uploader.email}</span>}
              <RecordingMeta a={a} />
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => void downloadFile(a.id)}>
              <Download aria-hidden /> Download
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

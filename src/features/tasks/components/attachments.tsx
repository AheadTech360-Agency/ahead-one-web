"use client";

import { Download, File, FileImage, FileSpreadsheet, FileText, FileVideo, FileArchive, Paperclip, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import type { Attachment, UserSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/ui/dialog";
import { IconButton } from "@/ui/icon-button";
import { Spinner } from "@/ui/spinner";
import { toast } from "@/ui/toaster";
import { ATTACHMENT_MIME, checkAttachment, downloadAttachment, useDeleteAttachment, useUploadAttachment } from "../api";
import { relativeTime } from "../lib/dates";

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
  if (mime === "application/zip") return FileArchive;
  if (mime.includes("sheet") || mime.includes("excel") || mime === "text/csv") return FileSpreadsheet;
  if (mime === "application/pdf" || mime.includes("word") || mime === "text/plain") return FileText;
  return File;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function Attachments({
  taskId,
  attachments,
  me,
  canUpload,
  canManage,
}: {
  taskId: string;
  attachments: Attachment[];
  me: UserSummary | undefined;
  canUpload: boolean;
  canManage: boolean;
}) {
  const upload = useUploadAttachment(taskId);
  const del = useDeleteAttachment(taskId);
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ key: string; name: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [confirm, setConfirm] = useState<Attachment | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  function send(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const problem = checkAttachment(file);
      if (problem) {
        toast.error("That file can't be attached", { description: problem });
        continue;
      }
      const key = `${file.name}-${file.size}-${Date.now()}`;
      setUploading((u) => [...u, { key, name: file.name }]);
      upload.mutate(file, {
        onError: (e) =>
          toast.error(`Couldn't upload ${file.name}`, {
            description: e instanceof Error && !("code" in e) ? e.message : `${errorMessage(e)} Try attaching it again.`,
          }),
        onSettled: () => setUploading((u) => u.filter((x) => x.key !== key)),
      });
    }
  }

  async function download(a: Attachment) {
    setDownloading(a.id);
    try {
      await downloadAttachment(a.id);
    } catch (e) {
      toast.error(`Couldn't download ${a.filename}`, { description: `${errorMessage(e)} Try again.` });
    } finally {
      setDownloading(null);
    }
  }

  const empty = attachments.length === 0 && uploading.length === 0;

  return (
    <div
      onDragOver={(e) => {
        if (!canUpload || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragOver(false)}
      onDrop={(e) => {
        if (!canUpload) return;
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) send(e.dataTransfer.files);
      }}
      className={cn("rounded-md transition-colors", dragOver && "bg-accent-subtle outline-2 outline-dashed outline-ring")}
    >
      {!empty && (
        <ul className="flex flex-col">
          {attachments.map((a) => {
            const Icon = iconFor(a.mime);
            const removable = canManage || (canUpload && a.uploader?.id === me?.id);
            return (
              <li key={a.id} className="group/a flex h-11 items-center gap-2.5 rounded-sm px-1.5 hover:bg-surface-sunken">
                <Icon className="size-4 shrink-0 text-fg-faint" aria-hidden />
                <button
                  type="button"
                  onClick={() => void download(a)}
                  className="min-w-0 flex-1 truncate text-left text-13 text-fg hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  title={`Download ${a.filename}`}
                >
                  {a.filename}
                </button>
                <span className="hidden shrink-0 text-12 text-fg-faint sm:inline tabular">
                  {formatBytes(a.size_bytes)}, {relativeTime(a.created_at)}
                </span>
                {downloading === a.id ? (
                  <Spinner className="text-fg-faint" label="Preparing download" />
                ) : (
                  <IconButton label={`Download ${a.filename}`} size="sm" onClick={() => void download(a)}>
                    <Download aria-hidden />
                  </IconButton>
                )}
                {removable && (
                  <IconButton label={`Delete ${a.filename}`} size="sm" onClick={() => setConfirm(a)}>
                    <Trash2 aria-hidden />
                  </IconButton>
                )}
              </li>
            );
          })}
          {uploading.map((u) => (
            <li key={u.key} className="flex h-11 items-center gap-2.5 px-1.5 text-13 text-fg-muted">
              <Spinner className="text-fg-faint" label={`Uploading ${u.name}`} />
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              <span className="text-12 text-fg-faint">Uploading</span>
            </li>
          ))}
        </ul>
      )}
      {canUpload ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cn(
            "flex w-full items-center gap-2 rounded-sm border border-dashed border-border-strong px-3 text-left text-13 text-fg-muted",
            "hover:border-fg-faint hover:bg-surface-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-ring",
            empty ? "h-14" : "mt-1.5 h-9",
          )}
        >
          <Upload className="size-4 text-fg-faint" aria-hidden />
          <span>
            {empty ? "Drop files here or choose files" : "Add files"}
            <span className="ml-1.5 text-12 text-fg-faint">Up to 25 MB each</span>
          </span>
        </button>
      ) : (
        empty && (
          <p className="flex h-9 items-center gap-2 px-1.5 text-13 text-fg-faint">
            <Paperclip className="size-4" aria-hidden /> No files attached.
          </p>
        )
      )}
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={[...ATTACHMENT_MIME, ".csv", ".mov"].join(",")}
        onChange={(e) => {
          if (e.target.files?.length) send(e.target.files);
          e.target.value = "";
        }}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${confirm?.filename ?? "this file"}?`}
        description="The file is removed from this task for everyone."
        confirmLabel="Delete file"
        onConfirm={() => {
          if (confirm) del.mutate(confirm.id);
          setConfirm(null);
        }}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/api/client";
import type { Attachment, FileItem } from "@/lib/api/types";
import { useWorkspace } from "@/lib/workspace";
import { ConfirmDialog, Dialog, DialogBody, DialogContent } from "@/ui/dialog";
import { toast } from "@/ui/toaster";
import { downloadFile, useAttachToTask, useDeleteFile } from "./api";
import { PlayerDialog } from "./media-player";
import { isPlayable } from "./parts";
import { TaskPicker } from "./task-picker";

export type FileActions = {
  open: (a: Attachment) => void;
  download: (a: Attachment) => void;
  askDelete: (f: FileItem) => void;
  askAttach: (a: Attachment) => void;
};

/** Open, download, delete and attach, with the dialogs they need. Render `dialogs` once next to the list. */
export function useFileActions(): { actions: FileActions; dialogs: React.ReactNode } {
  const { workspaceId } = useWorkspace();
  const [playing, setPlaying] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState<FileItem | null>(null);
  const [attaching, setAttaching] = useState<Attachment | null>(null);
  const del = useDeleteFile(workspaceId);
  const attach = useAttachToTask(workspaceId);

  async function download(a: Attachment) {
    try {
      await downloadFile(a.id);
    } catch (e) {
      toast.error(`Couldn't download ${a.filename}`, { description: `${errorMessage(e)} Try again.` });
    }
  }

  const actions: FileActions = {
    open: (a) => (isPlayable(a.mime) ? setPlaying(a) : void download(a)),
    download: (a) => void download(a),
    askDelete: setDeleting,
    askAttach: setAttaching,
  };

  const name = deleting?.attachment.filename ?? "this file";
  const dialogs = (
    <>
      <PlayerDialog a={playing} onOpenChange={(o) => !o && setPlaying(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${name}”?`}
        description={
          deleting?.source.kind === "recording"
            ? "This recording is removed for good."
            : `It is removed from ${deleting?.source.name ?? "where it was shared"} for everyone who can see it. This can't be undone.`
        }
        confirmLabel={`Delete ${name.length > 28 ? `${name.slice(0, 27)}…` : name}`}
        loading={del.isPending}
        onConfirm={() => {
          if (!deleting) return;
          const f = deleting;
          del.mutate(f.attachment.id, {
            onSuccess: () => toast.success(`Deleted ${f.attachment.filename}`),
            onError: (e) => toast.error(`Couldn't delete ${f.attachment.filename}`, { description: errorMessage(e) }),
            onSettled: () => setDeleting(null),
          });
        }}
      />
      <Dialog open={Boolean(attaching)} onOpenChange={(o) => !o && setAttaching(null)}>
        {attaching && (
          <DialogContent
            title="Attach to a task"
            description={`Anyone with access to the task can then watch “${attaching.filename}”.`}
            size="md"
          >
            <DialogBody>
              <TaskPicker
                autoFocus
                disabled={attach.isPending}
                onPick={(t) =>
                  attach.mutate(
                    { attachmentId: attaching.id, taskId: t.id },
                    {
                      onSuccess: () => {
                        toast.success(`Attached to ${t.title}`);
                        setAttaching(null);
                      },
                      onError: (e) => toast.error("Couldn't attach it", { description: errorMessage(e) }),
                    },
                  )
                }
              />
            </DialogBody>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
  return { actions, dialogs };
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { errorMessage, isApiError } from "@/lib/api/client";
import { useTree } from "@/lib/api/hooks";
import type { Task } from "@/lib/api/types";
import { tk, useUpdateTask } from "@/features/tasks/api";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/ui/button";
import { ConfirmDialog, Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/ui/dialog";
import { Field } from "@/ui/field";
import { Select } from "@/ui/select";
import { toast } from "@/ui/toaster";
import { moveErrorMessage, shareConfirmCopy, shareTargets } from "./logic";

/**
 * "Move to a shared project": the explicit way a private task becomes visible to others. Step one
 * picks the destination list, step two is a confirmation that names the project and says who will see it.
 */
export function MoveToSharedDialog({
  task,
  open,
  onOpenChange,
}: {
  task: Task;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { workspaceId } = useWorkspace();
  const tree = useTree(workspaceId);
  const qc = useQueryClient();
  const update = useUpdateTask();
  const targets = useMemo(() => shareTargets(tree.data), [tree.data]);
  const [listId, setListId] = useState<string | undefined>();
  const [confirm, setConfirm] = useState(false);
  const target = targets.find((t) => t.value === listId);
  const projectName = target?.label.split(" / ")[0] ?? "";
  const copy = shareConfirmCopy(task.title, projectName);

  function reset() {
    setConfirm(false);
    setListId(undefined);
  }

  function move() {
    if (!listId) return;
    update.mutate(
      { task, patch: { list_id: listId }, failure: "Couldn't move the task" },
      {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: tk.task(task.id) });
          toast.success(`Moved to ${projectName}`, { description: "Everyone who can see that project can now see this task." });
          onOpenChange(false);
          reset();
        },
        onError: (e) => {
          setConfirm(false);
          toast.error("Couldn't move the task", {
            description: moveErrorMessage(isApiError(e) ? e.status : undefined, errorMessage(e)),
          });
        },
      },
    );
  }

  return (
    <>
      <Dialog
        open={open && !confirm}
        onOpenChange={(o) => {
          if (!o) {
            onOpenChange(false);
            reset();
          }
        }}
      >
        <DialogContent title="Move to a shared project" description="Choose where this task goes. You will confirm before anyone can see it." size="md">
          <DialogBody>
            <Field
              label="Destination list"
              hint={targets.length === 0 && !tree.isPending ? "There is no shared project you can add to yet." : undefined}
            >
              <Select
                value={listId}
                onValueChange={setListId}
                options={targets}
                placeholder={tree.isPending ? "Loading lists" : "Choose a list"}
                disabled={targets.length === 0}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="primary" disabled={!listId} onClick={() => setConfirm(true)}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={open && confirm}
        onOpenChange={(o) => {
          if (!o) setConfirm(false);
        }}
        title={copy.title}
        description={copy.body}
        confirmLabel={copy.confirm}
        tone="primary"
        loading={update.isPending}
        onConfirm={move}
      />
    </>
  );
}

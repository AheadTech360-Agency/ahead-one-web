"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/lib/api/client";
import type { Priority } from "@/lib/api/types";
import { useCreateTask } from "@/features/tasks/api";
import { dateOnlyIso } from "@/features/tasks/lib/dates";
import { PRIORITIES, priorityLabel } from "@/ui/badge";
import { Button } from "@/ui/button";
import { DatePicker } from "@/ui/date-picker";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/ui/dialog";
import { Field } from "@/ui/field";
import { Input } from "@/ui/input";
import { Select } from "@/ui/select";
import { toast } from "@/ui/toaster";
import { usePersonal } from "./api";

/** Quick add for a private task: title, due date, priority. Creates the personal project on first use. */
export function PrivateTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Add private task"
        description="Only you can see this task. Nobody else, including the Owner, can open it."
        size="md"
      >
        {open && <Form onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const { ensureListId } = usePersonal();
  const create = useCreateTask();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [due, setDue] = useState<Date | null>(null);
  const [error, setError] = useState<string | undefined>();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      setError("Give the task a title.");
      return;
    }
    // Optimistic: close at once, report the outcome in a toast (the task appears in the lists as it lands).
    onDone();
    void (async () => {
      try {
        const listId = await ensureListId();
        const task = await create.mutateAsync({
          listId,
          body: {
            title: t,
            priority,
            due_at: due ? dateOnlyIso(due) : undefined,
            due_has_time: due ? false : undefined,
          },
        });
        toast.success("Private task added", {
          description: task.title,
          action: { label: "Open", onClick: () => router.push(`/t/${task.id}`) },
        });
      } catch (err) {
        toast.error("Couldn't add the private task", { description: errorMessage(err) });
      }
    })();
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogBody className="flex flex-col gap-4">
        <Field label="Title" error={error}>
          <Input
            autoFocus
            size="lg"
            value={title}
            maxLength={500}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError(undefined);
            }}
            placeholder="Prepare my review notes"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Priority">
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as Priority)}
              options={PRIORITIES.map((p) => ({ value: p, label: priorityLabel(p) }))}
            />
          </Field>
          <Field label="Due date" optional>
            <DatePicker value={due} onChange={setDue} className="w-full" />
          </Field>
        </div>
        <p className="flex items-center gap-1.5 text-12 text-fg-muted">
          <Lock className="size-3.5" aria-hidden /> Assigned to you and private.
        </p>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <Button type="submit" variant="primary">
          Add private task
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Quick action for Home and My Tasks. Renders nothing for Guests. */
export function PrivateTaskButton({ className, variant = "secondary" }: { className?: string; variant?: "secondary" | "ghost" }) {
  const { enabled } = usePersonal();
  const [open, setOpen] = useState(false);
  if (!enabled) return null;
  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        <Lock aria-hidden /> Private task
      </Button>
      <PrivateTaskDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

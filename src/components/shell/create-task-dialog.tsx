"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api/client";
import { useMembers, useTree } from "@/lib/api/hooks";
import type { CreateTask, Priority, Task } from "@/lib/api/types";
import { useWorkspace } from "@/lib/workspace";
import { PRIORITIES, PriorityBadge, priorityLabel } from "@/ui/badge";
import { Button } from "@/ui/button";
import { DatePicker } from "@/ui/date-picker";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/ui/dialog";
import { Field } from "@/ui/field";
import { Input } from "@/ui/input";
import { Select } from "@/ui/select";
import { toast } from "@/ui/toaster";
import { UserPicker } from "@/ui/user-picker";
import { useShell } from "./shell-context";

/** Quick-create from anywhere (C or the command menu). Posts CreateTask to the chosen list. */
export function CreateTaskDialog() {
  const { createTaskOpen, setCreateTaskOpen } = useShell();
  return (
    <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
      <DialogContent title="New task" size="md">
        {createTaskOpen && <CreateTaskForm onDone={() => setCreateTaskOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function CreateTaskForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { workspaceId } = useWorkspace();
  const tree = useTree(workspaceId);
  const members = useMembers(workspaceId);
  const [title, setTitle] = useState("");
  const [listId, setListId] = useState<string | undefined>();
  const [priority, setPriority] = useState<Priority>("normal");
  const [due, setDue] = useState<Date | null>(null);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ title?: string; list?: string; form?: string }>({});

  const listOptions = (tree.data ?? []).flatMap((s) =>
    s.projects
      .filter((p) => !p.archived)
      .flatMap((p) => p.lists.map((l) => ({ value: l.id, label: `${p.name} / ${l.name}`, description: s.name }))),
  );

  const create = useMutation({
    mutationFn: (body: CreateTask) =>
      api<Task>(`/v1/lists/${listId}/tasks`, { method: "POST", body }),
    onSuccess: (task) => {
      void qc.invalidateQueries({ queryKey: ["ws", workspaceId, "my-tasks"] });
      toast.success("Task created", {
        description: task.title,
        action: { label: "Open", onClick: () => router.push(`/t/${task.id}`) },
      });
      onDone();
    },
    onError: (e) => setErrors({ form: errorMessage(e) }),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Give the task a title.";
    if (!listId) next.list = "Choose where the task goes.";
    setErrors(next);
    if (next.title || next.list) return;
    create.mutate({
      title: title.trim(),
      priority,
      due_at: due ? due.toISOString() : undefined,
      due_has_time: due ? false : undefined,
      assignee_ids: assignees.length ? assignees : undefined,
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogBody className="flex flex-col gap-4">
        <Field label="Title" error={errors.title}>
          <Input
            autoFocus
            size="lg"
            value={title}
            maxLength={500}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((x) => ({ ...x, title: undefined }));
            }}
            placeholder="Draft May retargeting creatives"
          />
        </Field>
        <Field
          label="List"
          error={errors.list}
          hint={
            tree.isError
              ? "Lists couldn't load. Check your connection and reopen this dialog."
              : listOptions.length === 0 && !tree.isPending
                ? "No lists yet. Create a project from the sidebar first."
                : undefined
          }
        >
          <Select
            value={listId}
            onValueChange={(v) => {
              setListId(v);
              if (errors.list) setErrors((x) => ({ ...x, list: undefined }));
            }}
            options={listOptions}
            placeholder={tree.isPending ? "Loading lists" : "Choose a list"}
            disabled={listOptions.length === 0}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          <Field label="Assignees" optional>
            <UserPicker
              users={(members.data ?? []).map((m) => m.user)}
              value={assignees}
              onChange={setAssignees}
              className="w-full"
            />
          </Field>
        </div>
        <p className="flex items-center gap-1.5 text-12 text-fg-muted">
          <PriorityBadge priority={priority} iconOnly />
          {due ? `Due ${due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "No due date"}
          {assignees.length > 0 && `, ${assignees.length} assigned`}
        </p>
        {errors.form && (
          <p role="alert" className="rounded-sm bg-danger-subtle px-3 py-2 text-13 text-danger-text">
            {errors.form}
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <Button type="submit" variant="primary" loading={create.isPending}>
          Create task
        </Button>
      </DialogFooter>
    </form>
  );
}

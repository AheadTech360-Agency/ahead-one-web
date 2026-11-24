"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ListStatus, Task, TaskDetail, UserSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { AvatarStack } from "@/ui/avatar";
import { Spinner } from "@/ui/spinner";
import { toast } from "@/ui/toaster";
import { errorMessage } from "@/lib/api/client";
import { tk, useCreateTask, useUpdateTask } from "../api";
import type { Access } from "../lib/access";
import { DUE_TONE_CLASS, dueTone, formatDue } from "../lib/dates";
import { isDoneCategory } from "../lib/groups";
import { CompleteToggle } from "./task-controls";

/** Subtasks of a task: add, complete, and reorder by drag (or Space and arrows). */
export function Subtasks({
  detail,
  statuses,
  access,
  hrefFor,
}: {
  detail: TaskDetail;
  statuses: ListStatus[];
  access: Access;
  hrefFor: (id: string) => string;
  people?: UserSummary[];
}) {
  const qc = useQueryClient();
  const update = useUpdateTask();
  const create = useCreateTask();
  const [title, setTitle] = useState("");
  const subs = detail.subtasks;
  const done = subs.filter((s) => s.completed_at || isDoneCategory(statuses.find((x) => x.id === s.status_id)?.category)).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = subs.findIndex((s) => s.id === e.active.id);
    const to = subs.findIndex((s) => s.id === e.over!.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(subs, from, to);
    const key = tk.task(detail.task.id);
    const prev = qc.getQueryData<TaskDetail>(key);
    qc.setQueryData<TaskDetail>(key, (d) => (d ? { ...d, subtasks: next } : d));
    const moved = next[to];
    update.mutate(
      {
        task: moved,
        patch: { after_id: next[to - 1]?.id ?? null, before_id: next[to + 1]?.id ?? null },
        failure: "Couldn't reorder the subtask",
      },
      { onError: () => qc.setQueryData(key, prev) },
    );
  }

  function add() {
    const v = title.trim();
    if (!v) return;
    create.mutate(
      { listId: detail.task.list_id, body: { title: v, parent_task_id: detail.task.id } },
      {
        onSuccess: () => setTitle(""),
        onError: (e) => toast.error("Couldn't add the subtask", { description: `${errorMessage(e)} Your title is still in the box.` }),
      },
    );
  }

  return (
    <div className="flex flex-col">
      {subs.length > 0 && (
        <div className="mb-1 flex items-center gap-2" aria-hidden>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-active">
            <div className="h-full rounded-full bg-chart-2 transition-[width] duration-[var(--dur-base)]" style={{ width: `${(done / subs.length) * 100}%` }} />
          </div>
          <span className="text-12 text-fg-muted tabular">
            {done} of {subs.length}
          </span>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={subs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col">
            {subs.map((s) => (
              <SubtaskItem key={s.id} task={s} statuses={statuses} access={access} href={hrefFor(s.id)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {access.canEdit && (
        <div className="flex h-9 items-center gap-2 rounded-sm px-1.5 focus-within:bg-surface-sunken">
          {create.isPending ? <Spinner className="text-fg-faint" label="Adding subtask" /> : <Plus className="size-4 text-fg-faint" aria-hidden />}
          <input
            aria-label="New subtask"
            placeholder="Add a subtask"
            value={title}
            maxLength={500}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
              if (e.key === "Escape") setTitle("");
            }}
            className="h-8 min-w-0 flex-1 bg-transparent text-13 text-fg outline-none placeholder:text-fg-faint"
          />
        </div>
      )}
      {!access.canEdit && subs.length === 0 && <p className="px-1.5 text-13 text-fg-faint">No subtasks.</p>}
    </div>
  );
}

function SubtaskItem({ task, statuses, access, href }: { task: Task; statuses: ListStatus[]; access: Access; href: string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !access.canEdit,
  });
  const status = statuses.find((s) => s.id === task.status_id);
  const done = isDoneCategory(status?.category) || Boolean(task.completed_at);
  const tone = dueTone(task);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/s flex h-9 items-center gap-2 rounded-sm bg-surface-raised px-1.5 hover:bg-surface-sunken",
        isDragging && "relative z-10 shadow-popover",
      )}
    >
      {access.canEdit && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${task.title}`}
          className="-ml-1 inline-flex h-6 w-4 cursor-grab items-center justify-center rounded-xs text-fg-faint opacity-0 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring group-hover/s:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <GripVertical className="size-3.5" aria-hidden />
        </button>
      )}
      <CompleteToggle task={task} statuses={statuses} disabled={!access.canChangeStatus(task)} size="sm" />
      <Link
        href={href}
        scroll={false}
        className={cn("min-w-0 flex-1 truncate text-13 hover:underline", done ? "text-fg-muted line-through" : "text-fg")}
      >
        {task.title}
      </Link>
      {task.due_at && <span className={cn("shrink-0 text-12", DUE_TONE_CLASS[tone])}>{formatDue(task)}</span>}
      {task.assignees.length > 0 && <AvatarStack users={task.assignees} size="xs" max={2} />}
    </li>
  );
}

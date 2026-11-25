"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ListTree, MessageSquare, Paperclip, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Task } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { AvatarStack } from "@/ui/avatar";
import { PriorityBadge } from "@/ui/badge";
import { StatusGlyph } from "./task-controls";
import { Skeleton } from "@/ui/skeleton";
import { Spinner } from "@/ui/spinner";
import { toast } from "@/ui/toaster";
import { useCreateTask, useUpdateTask } from "../api";
import { DUE_TONE_CLASS, dueTone, formatDue } from "../lib/dates";
import { groupOfTask, isDoneCategory, type StatusGroup } from "../lib/groups";
import type { ScopeData } from "../lib/use-scope-data";
import { intent, usePrefetchers } from "@/lib/api/prefetch";
import { useTaskLink } from "../lib/use-task-filters";

/*
 * Board: one column per status. Drag between and within columns with the pointer, or focus a
 * card and press Space, move with the arrow keys, Space again to drop (Escape cancels).
 * On drop: PATCH status_id (if the column changed) and after_id/before_id = the neighbours at
 * the drop position (null at the ends). In a project view, neighbours must share the task's
 * list, so the nearest same-list cards are used.
 */

type Columns = Record<string, string[]>;

export function BoardView({ data, tasks, manualOrder }: { data: ScopeData; tasks: Task[]; manualOrder: boolean }) {
  const { groups, statusById, access } = data;
  const update = useUpdateTask();
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const derived = useMemo<Columns>(() => {
    const cols: Columns = Object.fromEntries(groups.map((g) => [g.key, [] as string[]]));
    for (const t of tasks) {
      const k = groupOfTask(t, statusById);
      if (k && cols[k]) cols[k].push(t.id);
    }
    return cols;
  }, [groups, tasks, statusById]);

  const [drag, setDrag] = useState<{ id: string; from: string; cols: Columns } | null>(null);
  const columns = drag?.cols ?? derived;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const containerOf = (id: string, cols: Columns) =>
    id in cols ? id : Object.keys(cols).find((k) => cols[k].includes(id));

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    const from = containerOf(id, derived);
    if (from) setDrag({ id, from, cols: derived });
  }

  function onDragOver(e: DragOverEvent) {
    if (!drag || !e.over) return;
    const overId = String(e.over.id);
    const from = containerOf(drag.id, drag.cols);
    const to = containerOf(overId, drag.cols);
    if (!from || !to || from === to) return;
    setDrag((d) => {
      if (!d) return d;
      const src = d.cols[from].filter((x) => x !== d.id);
      const dst = [...d.cols[to]];
      const at = overId in d.cols ? dst.length : Math.max(0, dst.indexOf(overId));
      dst.splice(at, 0, d.id);
      return { ...d, cols: { ...d.cols, [from]: src, [to]: dst } };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const d = drag;
    setDrag(null);
    if (!d || !e.over) return;
    const task = byId.get(d.id);
    if (!task) return;
    let cols = d.cols;
    const to = containerOf(d.id, cols);
    if (!to) return;
    const overId = String(e.over.id);
    if (!(overId in cols) && cols[to].includes(overId) && overId !== d.id) {
      cols = { ...cols, [to]: arrayMove(cols[to], cols[to].indexOf(d.id), cols[to].indexOf(overId)) };
    }
    const group = groups.find((g) => g.key === to);
    if (!group) return;
    const target = group.byList.get(task.list_id);
    if (!target) {
      toast.error(`Can't move to ${group.name}`, {
        description: `This task's list has no ${group.name} status. Add one in project settings, or pick another column.`,
      });
      return;
    }
    const statusChanged = target.id !== task.status_id;
    const order = cols[to];
    const idx = order.indexOf(d.id);
    const sameList = (id: string) => byId.get(id)?.list_id === task.list_id;
    const after = [...order.slice(0, idx)].reverse().find(sameList) ?? null;
    const before = order.slice(idx + 1).find(sameList) ?? null;
    const reordered = order.join() !== (derived[to] ?? []).join();
    if (!statusChanged && !reordered) return;

    // Reordering is only meaningful in manual order, and needs edit access.
    const withPosition = manualOrder && access.canEdit;
    if (!statusChanged && !withPosition) return;
    update.mutate({
      task,
      patch: {
        ...(statusChanged ? { status_id: target.id } : {}),
        ...(withPosition ? { after_id: after, before_id: before } : {}),
      },
      optimistic: statusChanged
        ? { completed_at: isDoneCategory(target.category) ? (task.completed_at ?? new Date().toISOString()) : null }
        : undefined,
      failure: statusChanged ? `Couldn't move the task to ${group.name}` : "Couldn't reorder the task",
    });
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${byId.get(String(active.id))?.title ?? "task"}.`,
    onDragOver: ({ active, over }) => {
      if (!over) return undefined;
      const col = groups.find((g) => g.key === containerOf(String(over.id), columns));
      return col ? `${byId.get(String(active.id))?.title ?? "Task"} is over ${col.name}.` : undefined;
    },
    onDragEnd: ({ active, over }) => {
      const col = over ? groups.find((g) => g.key === containerOf(String(over.id), columns)) : undefined;
      return col ? `Dropped ${byId.get(String(active.id))?.title ?? "task"} in ${col.name}.` : "Drop cancelled.";
    },
    onDragCancel: () => "Drop cancelled. The task is back where it was.",
  };

  const activeTask = drag ? byId.get(drag.id) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDrag(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "To move a task, press Space, use the arrow keys to choose a place, then press Space again. Escape cancels.",
        },
      }}
    >
      <div className="pb-4 sm:-mx-6 sm:overflow-x-auto sm:px-6 md:-mx-8 md:px-8">
        <div className="flex flex-col gap-3 sm:min-h-[360px] sm:flex-row sm:items-stretch">
          {groups.map((g) => (
            <Column key={g.key} group={g} ids={columns[g.key] ?? []} byId={byId} data={data} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
        {activeTask ? <CardBody task={activeTask} data={data} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  group,
  ids,
  byId,
  data,
}: {
  group: StatusGroup;
  ids: string[];
  byId: Map<string, Task>;
  data: ScopeData;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: group.key });
  const [adding, setAdding] = useState(false);
  return (
    <section
      aria-label={`${group.name}, ${ids.length} tasks`}
      className={cn(
        "flex w-full flex-col rounded-lg transition-[background-color,box-shadow] duration-[var(--dur-base)] sm:min-w-[264px] sm:max-w-[360px] sm:flex-1 sm:basis-0",
        isOver && "shadow-[inset_0_0_0_1.5px_var(--col)]",
      )}
      style={
        {
          "--col": group.color,
          backgroundColor: isOver ? `color-mix(in oklab, ${group.color} 10%, var(--surface-sunken))` : "var(--surface-sunken)",
        } as React.CSSProperties
      }
    >
      <header className="flex h-11 items-center justify-between gap-2 pl-3 pr-1.5">
        <span className="flex min-w-0 items-center gap-2">
          <StatusGlyph status={{ id: group.key, list_id: "", position: "", name: group.name, color: group.color, category: group.category }} size={14} />
          <span className="truncate text-13 font-semibold text-fg">{group.name}</span>
          <span
            className="rounded-full px-1.5 text-11 font-semibold tabular"
            style={{ backgroundColor: `color-mix(in oklab, ${group.color} 16%, transparent)`, color: `color-mix(in oklab, ${group.color} 70%, var(--fg))` }}
          >
            {ids.length}
          </span>
        </span>
        {data.access.canEdit && (
          <button
            type="button"
            aria-label={`Add task to ${group.name}`}
            onClick={() => setAdding(true)}
            className="inline-flex size-7 items-center justify-center rounded-sm text-fg-faint hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        )}
      </header>
      <SortableContext id={group.key} items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-1 flex-col gap-2 px-2 pb-2">
          {ids.map((id) => {
            const t = byId.get(id);
            return t ? <SortableCard key={id} task={t} data={data} /> : null;
          })}
          {ids.length === 0 && !adding && (
            <p className="flex h-16 items-center justify-center rounded-md border border-dashed border-[color-mix(in_oklab,var(--col)_35%,var(--border-strong))] text-12 text-fg-muted">
              {group.category === "done" ? "Finished work lands here" : "Drop a task here"}
            </p>
          )}
          {adding && <AddCard group={group} data={data} onClose={() => setAdding(false)} />}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({ task, data }: { task: Task; data: ScopeData }) {
  const canDrag = data.access.canChangeStatus(task);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !canDrag,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription={canDrag ? "Draggable task" : undefined}
      aria-label={task.title}
      className={cn(
        "rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        isDragging && "opacity-40",
        canDrag && "touch-manipulation",
      )}
    >
      <CardBody task={task} data={data} />
    </div>
  );
}

function CardBody({ task, data, overlay }: { task: Task; data: ScopeData; overlay?: boolean }) {
  const link = useTaskLink();
  const pf = usePrefetchers();
  const status = data.statusById.get(task.status_id);
  const done = isDoneCategory(status?.category) || Boolean(task.completed_at);
  const tone = dueTone(task);
  const listName = data.scope.kind === "project" && data.lists.length > 1 ? data.lists.find((l) => l.id === task.list_id)?.name : undefined;
  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-md border border-border bg-surface p-3 text-13 shadow-xs",
        "transition-[border-color,box-shadow,transform] duration-[var(--dur-fast)] ease-out",
        overlay
          ? "rotate-[1.5deg] scale-[1.02] cursor-grabbing border-border-strong shadow-popover"
          : "hover:border-border-strong motion-safe:hover:-translate-y-px",
      )}
    >
      <Link
        href={link.href(task.id)}
        scroll={false}
        tabIndex={-1}
        {...intent(() => pf.task(task.id))}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "line-clamp-3 font-medium leading-5 decoration-fg-faint hover:underline",
          done ? "text-fg-muted" : "text-fg",
        )}
      >
        {task.title}
      </Link>
      {listName && <span className="-mt-1 truncate text-12 text-fg-faint">{listName}</span>}
      <div className="flex items-center gap-2 text-12 text-fg-faint">
        {(task.priority === "urgent" || task.priority === "high") && <PriorityBadge priority={task.priority} iconOnly />}
        {task.due_at && (
          <span className={cn("whitespace-nowrap", DUE_TONE_CLASS[tone], tone === "overdue" && "font-medium")}>
            {formatDue(task)}
          </span>
        )}
        {task.subtask_count > 0 && (
          <span className="inline-flex items-center gap-0.5 tabular" title="Subtasks done">
            <ListTree className="size-3.5" aria-hidden />
            {task.done_subtask_count}/{task.subtask_count}
          </span>
        )}
        {task.comment_count > 0 && (
          <span className="inline-flex items-center gap-0.5 tabular" title="Comments">
            <MessageSquare className="size-3.5" aria-hidden />
            {task.comment_count}
          </span>
        )}
        {task.attachment_count > 0 && (
          <span className="inline-flex items-center gap-0.5 tabular" title="Files">
            <Paperclip className="size-3.5" aria-hidden />
            {task.attachment_count}
          </span>
        )}
        {task.assignees.length > 0 && <AvatarStack users={task.assignees} size="xs" max={3} className="ml-auto" />}
      </div>
    </article>
  );
}

function AddCard({ group, data, onClose }: { group: StatusGroup; data: ScopeData; onClose: () => void }) {
  const create = useCreateTask();
  const [title, setTitle] = useState("");
  const target = data.lists.find((l) => group.byList.has(l.id));
  const status = target ? group.byList.get(target.id) : undefined;
  function submit() {
    const v = title.trim();
    if (!v || !target || !status) return;
    create.mutate(
      { listId: target.id, body: { title: v, status_id: status.id } },
      {
        onSuccess: () => setTitle(""),
        onError: () => toast.error("Couldn't add the task", { description: "Check your connection. Your title is still in the card." }),
      },
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-sm border border-ring bg-surface p-2">
      <textarea
        autoFocus
        rows={2}
        aria-label={`New task in ${group.name}`}
        placeholder="Task title"
        value={title}
        maxLength={500}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => !title.trim() && onClose()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") onClose();
        }}
        className="min-w-0 flex-1 resize-none bg-transparent text-13 text-fg outline-none placeholder:text-fg-faint"
      />
      {create.isPending && <Spinner className="mt-1 text-fg-faint" label="Adding task" />}
    </div>
  );
}

export function BoardSkeletonColumns() {
  return (
    <div className="flex gap-3 overflow-hidden" role="status" aria-label="Loading board">
      {[4, 2, 3].map((n, c) => (
        <div key={c} className="flex min-w-[264px] flex-1 flex-col gap-2 rounded-lg bg-surface-sunken p-2">
          <Skeleton className="m-1.5 h-5 w-24 rounded-full" />
          {Array.from({ length: n }, (_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-sm border border-border bg-surface p-2.5">
              <Skeleton className="h-3" style={{ width: `${55 + ((i * 17 + c * 9) % 35)}%` }} />
              <div className="flex items-center justify-between">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="size-5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

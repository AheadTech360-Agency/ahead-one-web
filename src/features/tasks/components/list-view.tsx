"use client";

import { ChevronRight, CornerDownLeft, ListTree, MessageSquare, Paperclip, Plus, SearchX, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ListStatus, Priority, Task } from "@/lib/api/types";
import { useStoredState } from "@/lib/hooks/use-stored-state";
import { cn } from "@/lib/utils";
import { PRIORITIES, PriorityBadge, StatusPill } from "@/ui/badge";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/dialog";
import { DueDatePicker } from "@/ui/due-date-picker";
import { EmptyState } from "@/ui/empty-state";
import { Kbd } from "@/ui/kbd";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/menu";
import { Skeleton } from "@/ui/skeleton";
import { Spinner } from "@/ui/spinner";
import { toast } from "@/ui/toaster";
import { useCreateTask, useDeleteTask, useTasks, useUpdateTask } from "../api";
import { dateOnlyIso, withTimeIso } from "../lib/dates";
import { groupOfTask, isDoneCategory, type StatusGroup } from "../lib/groups";
import type { ScopeData } from "../lib/use-scope-data";
import { useTaskLink } from "../lib/use-task-filters";
import { AssigneeControl, DueControl, PriorityControl, StatusGlyph, StatusGlyphControl } from "./task-controls";

/*
 * List view: tasks grouped by status, collapsible groups with counts, an add row per group,
 * inline edits on every field, subtasks expandable in place.
 * Keyboard: j/k (or arrows) move, Enter opens, x selects, e edits the title.
 */

const COLS = "md:grid-cols-[minmax(0,1fr)_104px_120px_36px]";

type Props = {
  data: ScopeData;
  tasks: Task[];
  manualOrder: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  filtered: boolean;
  clearFilters: () => void;
};

export function ListView({ data, tasks, hasMore, loadingMore, loadMore, filtered, clearFilters }: Props) {
  const { groups, statusById, access, scope } = data;
  const link = useTaskLink();
  const [collapsed, setCollapsed] = useStoredState<string[]>(`ahead-one.collapsed.${scope.kind}.${scope.id}`, []);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const byGroup = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      const k = groupOfTask(t, statusById) ?? "__other";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return m;
  }, [tasks, statusById]);

  const shownGroups = useMemo(() => {
    const gs: (StatusGroup | { key: "__other"; name: string })[] = [...groups];
    if (byGroup.has("__other")) gs.push({ key: "__other", name: "Other" });
    // When filtering, hide groups with nothing in them.
    return filtered ? gs.filter((g) => (byGroup.get(g.key)?.length ?? 0) > 0) : gs;
  }, [groups, byGroup, filtered]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  function focusRow(id: string) {
    setFocusId(id);
    containerRef.current?.querySelector<HTMLElement>(`[data-row="${id}"]`)?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Rows in visual order, including expanded subtasks, read from the DOM.
    const order = [...(containerRef.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [])].map(
      (el) => el.dataset.row!,
    );
    const current = focusId && order.includes(focusId) ? focusId : null;
    const i = current ? order.indexOf(current) : -1;
    switch (e.key) {
      case "j":
      case "ArrowDown":
        if (order.length) {
          e.preventDefault();
          focusRow(order[Math.min(order.length - 1, i + 1)]);
        }
        break;
      case "k":
      case "ArrowUp":
        if (order.length) {
          e.preventDefault();
          focusRow(order[Math.max(0, i - 1)]);
        }
        break;
      case "Enter":
        if (current && t.dataset.row) {
          e.preventDefault();
          link.open(current);
        }
        break;
      case "x":
        if (current) {
          e.preventDefault();
          toggleSelect(current);
        }
        break;
      case "e":
        if (current && access.canEdit) {
          e.preventDefault();
          setEditingId(current);
        }
        break;
      case "Escape":
        if (selected.size) {
          e.preventDefault();
          setSelected(new Set());
        }
        break;
    }
  }

  // Load more when the end of the list scrolls into view.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  if (tasks.length === 0 && filtered) {
    return (
      <EmptyState
        icon={SearchX}
        title="No tasks match these filters"
        description="Loosen a filter or clear them all to see every task."
        action={<Button onClick={clearFilters}>Clear filters</Button>}
      />
    );
  }

  const selectedTasks = tasks.filter((t) => selected.has(t.id));

  return (
    <div ref={containerRef} onKeyDown={onKeyDown} className="relative">
      <div
        role="row"
        aria-hidden
        className={cn("sticky top-0 z-[var(--z-sticky)] hidden h-8 items-center border-b border-border bg-surface pl-12 pr-2 text-12 text-fg-muted md:grid", COLS)}
      >
        <span>Task</span>
        <span className="pl-1">Assignees</span>
        <span className="pl-1">Due</span>
        <span className="pl-1">
          <span className="sr-only">Priority</span>
        </span>
      </div>

      {shownGroups.map((g) => {
        const rows = byGroup.get(g.key) ?? [];
        const isCollapsed = collapsed.includes(g.key);
        const status = "color" in g ? g : null;
        const addable = status && access.canEdit;
        return (
          <section key={g.key} aria-label={`${g.name}, ${rows.length} tasks`} className="border-b border-border-subtle last:border-b-0">
            <div className="group/head sticky top-0 z-[calc(var(--z-sticky)-1)] flex h-11 items-center gap-1.5 bg-surface px-2 md:top-8">
              <button
                type="button"
                aria-expanded={!isCollapsed}
                aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${g.name}`}
                onClick={() =>
                  setCollapsed((c) => (c.includes(g.key) ? c.filter((x) => x !== g.key) : [...c, g.key]))
                }
                className="inline-flex h-7 items-center gap-2 rounded-sm px-1.5 hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring"
              >
                <ChevronRight
                  className={cn("size-3.5 text-fg-faint transition-transform duration-[var(--dur-fast)]", !isCollapsed && "rotate-90")}
                  aria-hidden
                />
                {status && <StatusGlyph status={{ ...status, id: status.key, list_id: "", position: "" }} size={14} />}
                <span className="text-13 font-semibold text-fg">{g.name}</span>
                <span className="text-12 text-fg-faint tabular">{rows.length}</span>
              </button>
              {addable && (
                <button
                  type="button"
                  aria-label={`Add task to ${g.name}`}
                  onClick={() => {
                    if (isCollapsed) setCollapsed((c) => c.filter((x) => x !== g.key));
                    setAdding(g.key);
                  }}
                  className="inline-flex size-7 items-center justify-center rounded-sm text-fg-faint opacity-0 hover:bg-hover hover:text-fg focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring group-hover/head:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              )}
            </div>
            {!isCollapsed && (
              <div role="list">
                {rows.map((t) => {
                  const open = expanded.has(t.id);
                  return (
                    <div key={t.id} role="listitem">
                      <TaskRow
                        task={t}
                        data={data}
                        focused={focusId === t.id}
                        selected={selected.has(t.id)}
                        editing={editingId === t.id}
                        expanded={open}
                        onExpand={() =>
                          setExpanded((s) => {
                            const n = new Set(s);
                            if (n.has(t.id)) n.delete(t.id);
                            else n.add(t.id);
                            return n;
                          })
                        }
                        onFocus={() => setFocusId(t.id)}
                        onEditDone={() => setEditingId(null)}
                        onStartEdit={() => setEditingId(t.id)}
                        onToggleSelect={() => toggleSelect(t.id)}
                      />
                      {open && (
                        <SubtaskRows
                          parent={t}
                          data={data}
                          focusId={focusId}
                          setFocusId={setFocusId}
                          editingId={editingId}
                          setEditingId={setEditingId}
                          selected={selected}
                          toggleSelect={toggleSelect}
                        />
                      )}
                    </div>
                  );
                })}
                {rows.length === 0 && adding !== g.key && (
                  <p className="flex h-9 items-center pl-12 text-13 text-fg-faint">No tasks in {g.name}.</p>
                )}
                {status && adding === g.key && (
                  <AddRow group={status} data={data} onClose={() => setAdding(null)} />
                )}
                {addable && adding !== g.key && (
                  <button
                    type="button"
                    onClick={() => setAdding(g.key)}
                    className="flex h-9 w-full items-center gap-2 pl-11 text-left text-13 text-fg-faint hover:bg-surface-sunken hover:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                  >
                    <Plus className="size-4" aria-hidden /> Add task
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}

      {hasMore && (
        <div ref={sentinel} className="flex h-12 items-center justify-center">
          {loadingMore ? <Spinner className="text-fg-faint" label="Loading more tasks" /> : (
            <Button size="sm" variant="ghost" onClick={loadMore}>
              Load more tasks
            </Button>
          )}
        </div>
      )}

      {selectedTasks.length > 0 && (
        <BulkBar tasks={selectedTasks} data={data} onClear={() => setSelected(new Set())} />
      )}
    </div>
  );
}

/* ---------- Row ---------- */

function TaskRow({
  task,
  data,
  focused,
  selected,
  editing,
  expanded,
  onExpand,
  onFocus,
  onEditDone,
  onStartEdit,
  onToggleSelect,
  depth = 0,
}: {
  task: Task;
  data: ScopeData;
  focused: boolean;
  selected: boolean;
  editing: boolean;
  expanded?: boolean;
  onExpand?: () => void;
  onFocus: () => void;
  onEditDone: () => void;
  onStartEdit: () => void;
  onToggleSelect: () => void;
  depth?: number;
}) {
  const { access, statuses, people, scope, lists } = data;
  const link = useTaskLink();
  const canEdit = access.canEdit;
  const status = data.statusById.get(task.status_id);
  const done = isDoneCategory(status?.category) || Boolean(task.completed_at);
  const listName = scope.kind === "project" && lists.length > 1 ? lists.find((l) => l.id === task.list_id)?.name : undefined;

  return (
    <div
      data-row={task.id}
      tabIndex={focused ? 0 : -1}
      onFocus={(e) => e.target === e.currentTarget && onFocus()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onFocus();
      }}
      aria-selected={selected}
      className={cn(
        "group/row relative grid min-h-10 grid-cols-[minmax(0,1fr)] items-center border-t border-border-subtle pr-2 outline-none transition-colors duration-[var(--dur-instant)]",
        COLS,
        "hover:bg-surface-sunken focus-visible:bg-surface-sunken",
        "focus-visible:before:absolute focus-visible:before:inset-y-0 focus-visible:before:left-0 focus-visible:before:w-0.5 focus-visible:before:bg-ring",
        selected && "bg-accent-subtle hover:bg-accent-subtle",
      )}
    >
      <div className="flex min-w-0 items-center gap-2 py-1.5" style={{ paddingLeft: 8 + depth * 24 }}>
        <span className="flex w-4 shrink-0 justify-center">
          {onExpand && task.subtask_count > 0 ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={`${expanded ? "Hide" : "Show"} ${task.subtask_count} subtasks`}
              onClick={onExpand}
              className="inline-flex size-5 items-center justify-center rounded-xs text-fg-faint hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ChevronRight className={cn("size-3.5 transition-transform", expanded && "rotate-90")} aria-hidden />
            </button>
          ) : null}
        </span>
        <button
          type="button"
          aria-label={selected ? `Deselect ${task.title}` : `Select ${task.title}`}
          aria-pressed={selected}
          onClick={onToggleSelect}
          className={cn(
            "absolute left-0 top-0 hidden h-full w-2 md:block",
            selected ? "bg-accent" : "bg-transparent",
          )}
          tabIndex={-1}
        />
        <StatusGlyphControl task={task} statuses={statuses} disabled={!access.canChangeStatus(task)} />
        {editing && canEdit ? (
          <TitleEditor task={task} onDone={onEditDone} />
        ) : (
          <Link
            href={link.href(task.id)}
            scroll={false}
            onDoubleClick={(e) => {
              if (!canEdit) return;
              e.preventDefault();
              onStartEdit();
            }}
            className={cn(
              "min-w-0 truncate rounded-xs text-13 focus-visible:outline-2 focus-visible:outline-ring",
              done ? "text-fg-muted line-through decoration-fg-faint" : "text-fg",
            )}
          >
            {task.title}
          </Link>
        )}
        <RowMeta task={task} listName={listName} />
      </div>
      {/* Wide screens: one control per column. Narrow: a compact second line. */}
      <div className="hidden md:block">
        <AssigneeControl task={task} users={people} disabled={!canEdit} compact />
      </div>
      <div className="hidden md:block">
        <DueControl task={task} disabled={!canEdit} revealEmpty />
      </div>
      <div className="hidden justify-end md:flex">
        <PriorityControl task={task} disabled={!canEdit} iconOnly quiet />
      </div>
      {(task.due_at || task.priority === "urgent" || task.priority === "high" || task.assignees.length > 0) && (
        <div className="-mt-1.5 flex flex-wrap items-center gap-x-1 pb-1.5 md:hidden" style={{ paddingLeft: 52 + depth * 24 }}>
          {task.due_at && <DueControl task={task} disabled={!canEdit} />}
          {(task.priority === "urgent" || task.priority === "high") && <PriorityControl task={task} disabled={!canEdit} />}
          {task.assignees.length > 0 && <AssigneeControl task={task} users={people} disabled={!canEdit} compact />}
        </div>
      )}
    </div>
  );
}

function RowMeta({ task, listName }: { task: Task; listName?: string }) {
  const items: React.ReactNode[] = [];
  if (task.subtask_count > 0)
    items.push(
      <span key="s" className="inline-flex items-center gap-0.5" title={`${task.done_subtask_count} of ${task.subtask_count} subtasks done`}>
        <ListTree className="size-3.5" aria-hidden />
        <span className="tabular">
          {task.done_subtask_count}/{task.subtask_count}
        </span>
      </span>,
    );
  if (task.comment_count > 0)
    items.push(
      <span key="c" className="inline-flex items-center gap-0.5" title={`${task.comment_count} comments`}>
        <MessageSquare className="size-3.5" aria-hidden />
        <span className="tabular">{task.comment_count}</span>
      </span>,
    );
  if (task.attachment_count > 0)
    items.push(
      <span key="a" className="inline-flex items-center gap-0.5" title={`${task.attachment_count} files`}>
        <Paperclip className="size-3.5" aria-hidden />
        <span className="tabular">{task.attachment_count}</span>
      </span>,
    );
  if (!items.length && !listName) return null;
  return (
    <span className="flex shrink-0 items-center gap-2 text-12 text-fg-faint">
      {items}
      {listName && <span className="hidden max-w-32 truncate lg:inline">{listName}</span>}
    </span>
  );
}

function TitleEditor({ task, onDone }: { task: Task; onDone: () => void }) {
  const update = useUpdateTask();
  const [value, setValue] = useState(task.title);
  const saved = useRef(false);
  function save() {
    if (saved.current) return;
    saved.current = true;
    const v = value.trim();
    if (v && v !== task.title) update.mutate({ task, patch: { title: v }, failure: "Couldn't rename the task" });
    onDone();
  }
  return (
    <input
      autoFocus
      aria-label="Task title"
      value={value}
      maxLength={500}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={save}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") save();
        if (e.key === "Escape") {
          saved.current = true;
          onDone();
        }
      }}
      className="-my-1 h-7 min-w-0 flex-1 rounded-xs border border-ring bg-surface px-1.5 text-13 text-fg outline-none ring-[3px] ring-[color-mix(in_srgb,var(--ring)_22%,transparent)]"
    />
  );
}

/* ---------- Subtasks ---------- */

function SubtaskRows({
  parent,
  data,
  focusId,
  setFocusId,
  editingId,
  setEditingId,
  selected,
  toggleSelect,
}: {
  parent: Task;
  data: ScopeData;
  focusId: string | null;
  setFocusId: (id: string) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  selected: Set<string>;
  toggleSelect: (id: string) => void;
}) {
  const q = useTasks({ kind: "list", id: parent.list_id }, { parent: parent.id });
  const subs = q.data?.pages.flatMap((p) => p.items) ?? [];
  if (q.isPending) {
    return (
      <div className="flex h-9 items-center gap-2 border-t border-border-subtle pl-[72px]" role="status" aria-label="Loading subtasks">
        <Skeleton className="size-4 rounded-full" />
        <Skeleton className="h-3 w-48" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <p className="flex h-9 items-center gap-2 border-t border-border-subtle pl-[72px] text-13 text-danger-text">
        Subtasks didn&apos;t load.
        <button type="button" className="underline" onClick={() => void q.refetch()}>
          Try again
        </button>
      </p>
    );
  }
  return (
    <>
      {subs.map((s) => {
        return (
          <TaskRow
            key={s.id}
            task={s}
            data={data}
            depth={1}
            focused={focusId === s.id}
            selected={selected.has(s.id)}
            editing={editingId === s.id}
            onFocus={() => setFocusId(s.id)}
            onEditDone={() => setEditingId(null)}
            onStartEdit={() => setEditingId(s.id)}
            onToggleSelect={() => toggleSelect(s.id)}
          />
        );
      })}
    </>
  );
}

/* ---------- Add row ---------- */

function AddRow({ group, data, onClose }: { group: StatusGroup; data: ScopeData; onClose: () => void }) {
  const create = useCreateTask();
  const [title, setTitle] = useState("");
  // In a project view, a new task goes to the first list that has this status.
  const target = data.lists.find((l) => group.byList.has(l.id));
  const status = target ? group.byList.get(target.id) : undefined;

  function submit() {
    const v = title.trim();
    if (!v || !target || !status) return;
    create.mutate(
      { listId: target.id, body: { title: v, status_id: status.id } },
      {
        onSuccess: () => setTitle(""),
        onError: (e) =>
          toast.error("Couldn't add the task", {
            description: `${e instanceof Error ? e.message : "Something went wrong."} Your title is still in the row.`,
          }),
      },
    );
  }

  return (
    <div className="flex h-9 items-center gap-2 border-t border-border-subtle bg-surface-sunken pl-8 pr-2">
      <span aria-hidden className="size-4 shrink-0 rounded-full border-[1.5px] border-dashed" style={{ borderColor: group.color }} />
      <input
        autoFocus
        aria-label={`New task in ${group.name}`}
        placeholder={
          data.scope.kind === "project" && data.lists.length > 1 && target
            ? `Task title, added to ${target.name}`
            : "Task title"
        }
        value={title}
        maxLength={500}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => !title.trim() && onClose()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") onClose();
        }}
        className="h-7 min-w-0 flex-1 bg-transparent text-13 text-fg outline-none placeholder:text-fg-faint"
      />
      {create.isPending ? (
        <Spinner className="text-fg-faint" label="Adding task" />
      ) : (
        <span className="hidden items-center gap-1 text-12 text-fg-faint sm:flex">
          <Kbd>
            <CornerDownLeft className="size-3" aria-label="Enter" />
          </Kbd>
          to add
        </span>
      )}
    </div>
  );
}

/* ---------- Bulk actions ---------- */

function BulkBar({ tasks, data, onClear }: { tasks: Task[]; data: ScopeData; onClear: () => void }) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  const [confirm, setConfirm] = useState(false);
  const canEdit = data.access.canEdit;

  function setStatusGroup(g: StatusGroup) {
    let skipped = 0;
    for (const t of tasks) {
      const s: ListStatus | undefined = g.byList.get(t.list_id);
      if (!s) {
        skipped++;
        continue;
      }
      if (s.id !== t.status_id) update.mutate({ task: t, patch: { status_id: s.id }, failure: "Couldn't change a status" });
    }
    if (skipped) toast.info(`${skipped} task${skipped > 1 ? "s" : ""} kept their status`, { description: `Their list has no ${g.name} status.` });
  }

  return (
    <div
      role="toolbar"
      aria-label="Selected tasks"
      className="sticky bottom-3 z-[var(--z-sticky)] mx-auto mt-3 flex w-fit max-w-[calc(100%-16px)] flex-wrap items-center gap-1 rounded-md border border-border bg-surface-raised p-1 pl-3 shadow-popover animate-in-pop"
    >
      <span className="mr-1 text-13 font-medium text-fg tabular">{tasks.length} selected</span>
      {canEdit && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {data.groups.map((g) => (
                <DropdownMenuItem key={g.key} onSelect={() => setStatusGroup(g)}>
                  <StatusPill name={g.name} color={g.color} category={g.category} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                Priority
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {PRIORITIES.map((p) => (
                <DropdownMenuItem
                  key={p}
                  onSelect={() =>
                    tasks.forEach(
                      (t) => t.priority !== p && update.mutate({ task: t, patch: { priority: p as Priority }, failure: "Couldn't change a priority" }),
                    )
                  }
                >
                  <PriorityBadge priority={p} className="text-13 text-fg" />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DueDatePicker
            value={null}
            hasTime={false}
            variant="inline"
            label={<span className="text-12 font-medium text-fg-muted">Due date</span>}
            onChange={(d, hasTime) =>
              tasks.forEach((t) =>
                update.mutate({
                  task: t,
                  patch: d
                    ? { due_at: hasTime ? withTimeIso(d, d.getHours(), d.getMinutes()) : dateOnlyIso(d), due_has_time: hasTime }
                    : { due_at: null, due_has_time: false },
                  failure: "Couldn't change a due date",
                }),
              )
            }
          />
          <Button size="sm" variant="ghost" className="text-danger-text hover:text-danger-text" onClick={() => setConfirm(true)}>
            <Trash2 aria-hidden /> Delete
          </Button>
        </>
      )}
      <button
        type="button"
        aria-label="Clear selection"
        onClick={onClear}
        className="inline-flex size-7 items-center justify-center rounded-sm text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
      >
        <X className="size-4" aria-hidden />
      </button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${tasks.length} task${tasks.length > 1 ? "s" : ""}?`}
        description="Their subtasks, comments and files go with them. This can't be undone from here."
        confirmLabel={`Delete ${tasks.length} task${tasks.length > 1 ? "s" : ""}`}
        onConfirm={() => {
          tasks.forEach((t) => del.mutate(t));
          setConfirm(false);
          onClear();
        }}
      />
    </div>
  );
}

/** Row-shaped skeleton for the list view, matching row height and columns. */
export function ListViewSkeleton() {
  return (
    <div role="status" aria-label="Loading tasks">
      {[5, 3].map((n, g) => (
        <div key={g} className="border-b border-border-subtle">
          <div className="flex h-10 items-center gap-2 px-3">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-3 w-4" />
          </div>
          {Array.from({ length: n }, (_, i) => (
            <div key={i} className={cn("grid h-9 items-center border-t border-border-subtle pr-2", COLS)}>
              <div className="flex items-center gap-2 pl-8">
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className="h-3" style={{ width: `${40 + ((i * 13 + g * 7) % 35)}%` }} />
              </div>
              <Skeleton className="hidden h-5 w-20 rounded-full md:block" />
              <Skeleton className="hidden size-5 rounded-full md:block" />
              <Skeleton className="hidden h-3 w-14 md:block" />
              <Skeleton className="hidden size-3.5 md:block" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

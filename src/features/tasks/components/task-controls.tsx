"use client";

import { CalendarPlus, Check, ChevronDown, UserPlus, X } from "lucide-react";
import { useMemo } from "react";
import { useMembers } from "@/lib/api/hooks";
import type { ListStatus, Priority, Task, UserSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { AvatarStack } from "@/ui/avatar";
import { PRIORITIES, PriorityBadge, StatusPill, priorityLabel } from "@/ui/badge";
import { DueDatePicker } from "@/ui/due-date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/ui/menu";
import { UserPicker } from "@/ui/user-picker";
import { useProjectMembers, useSetAssignees, useUpdateTask } from "../api";
import { DUE_TONE_CLASS, dateOnlyIso, dueDate, dueTone, formatDue, withTimeIso } from "../lib/dates";
import { doneStatusFor, isDoneCategory, openStatusFor, statusesOfList } from "../lib/groups";

/** People who can be assigned in a project: its members, or the workspace while those load. */
export function useAssignable(projectId: string | undefined) {
  const { workspaceId } = useWorkspace();
  const pm = useProjectMembers(projectId);
  const wm = useMembers(workspaceId);
  return useMemo<UserSummary[]>(
    () => pm.data?.map((m) => m.user) ?? wm.data?.map((m) => m.user) ?? [],
    [pm.data, wm.data],
  );
}

/** Empty or low-signal controls in dense rows appear on row hover or focus (always on touch). */
export const reveal =
  "opacity-0 transition-opacity duration-[var(--dur-fast)] group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100";

const triggerBase =
  "inline-flex h-7 items-center gap-1 rounded-xs px-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring " +
  "enabled:hover:bg-hover data-[state=open]:bg-active disabled:cursor-default";

/* ---------- Status ---------- */

export function StatusControl({
  task,
  statuses,
  disabled,
  className,
  showChevron,
}: {
  task: Task;
  /** All known statuses; only the task's list is offered. */
  statuses: ListStatus[];
  disabled?: boolean;
  className?: string;
  showChevron?: boolean;
}) {
  const update = useUpdateTask();
  const own = statusesOfList(statuses, task.list_id);
  const current = own.find((s) => s.id === task.status_id);
  const pill = current ? (
    <StatusPill name={current.name} color={current.color} category={current.category} />
  ) : (
    <span className="text-12 text-fg-faint">No status</span>
  );
  if (disabled || own.length === 0) {
    return <span className={cn("inline-flex h-7 items-center px-1", className)}>{pill}</span>;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(triggerBase, className)}
        aria-label={`Status: ${current?.name ?? "none"}. Change status`}
      >
        {pill}
        {showChevron && <ChevronDown className="size-3.5 text-fg-faint" aria-hidden />}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-48">
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={task.status_id}
          onValueChange={(id) => {
            const s = own.find((x) => x.id === id);
            if (!s || id === task.status_id) return;
            update.mutate({
              task,
              patch: { status_id: id },
              optimistic: { completed_at: isDoneCategory(s.category) ? new Date().toISOString() : null },
              failure: "Couldn't change the status",
            });
          }}
        >
          {own.map((s) => (
            <DropdownMenuRadioItem key={s.id} value={s.id}>
              <StatusPill name={s.name} color={s.color} category={s.category} />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The status as a ring glyph: empty for to-do, half for active, filled check for done, cross for closed. */
export function StatusGlyph({ status, size = 16 }: { status: ListStatus | undefined; size?: number }) {
  const color = status?.color ?? "var(--fg-faint)";
  const c = status?.category ?? "todo";
  const filled = c === "done" || c === "closed";
  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color] duration-[var(--dur-base)]"
      style={{ width: size, height: size, boxShadow: `inset 0 0 0 1.5px ${color}`, backgroundColor: filled ? color : "transparent" }}
    >
      {c === "active" && (
        <span
          className="rounded-full"
          style={{ width: size - 6, height: size - 6, background: `conic-gradient(${color} 0 50%, transparent 50% 100%)` }}
        />
      )}
      {c === "done" && <Check className="size-2.5 text-white" strokeWidth={3.5} />}
      {c === "closed" && <X className="size-2.5 text-white" strokeWidth={3.5} />}
    </span>
  );
}

/** The status ring as a menu trigger: the row's one status control. */
export function StatusGlyphControl({ task, statuses, disabled }: { task: Task; statuses: ListStatus[]; disabled?: boolean }) {
  const update = useUpdateTask();
  const own = statusesOfList(statuses, task.list_id);
  const current = own.find((s) => s.id === task.status_id);
  if (disabled || own.length === 0) {
    return (
      <span className="inline-flex size-6 shrink-0 items-center justify-center" title={current?.name}>
        <StatusGlyph status={current} />
        <span className="sr-only">Status: {current?.name ?? "none"}</span>
      </span>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Status: ${current?.name ?? "none"}. Change status`}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-transform duration-[var(--dur-fast)] ease-out hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring data-[state=open]:scale-110"
      >
        <StatusGlyph status={current} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-48">
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={task.status_id}
          onValueChange={(id) => {
            const s = own.find((x) => x.id === id);
            if (!s || id === task.status_id) return;
            update.mutate({
              task,
              patch: { status_id: id },
              optimistic: { completed_at: isDoneCategory(s.category) ? new Date().toISOString() : null },
              failure: "Couldn't change the status",
            });
          }}
        >
          {own.map((s) => (
            <DropdownMenuRadioItem key={s.id} value={s.id}>
              <StatusGlyph status={s} size={14} />
              {s.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Round check that moves a task to its list's done status, or back to the first open one. */
export function CompleteToggle({
  task,
  statuses,
  disabled,
  size = "md",
}: {
  task: Task;
  statuses: ListStatus[];
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const update = useUpdateTask();
  const current = statuses.find((s) => s.id === task.status_id);
  const done = isDoneCategory(current?.category) || Boolean(task.completed_at);
  const target = done ? openStatusFor(statuses, task.list_id) : doneStatusFor(statuses, task.list_id);
  const color = current?.color ?? "var(--fg-faint)";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
      disabled={disabled || !target}
      onClick={(e) => {
        e.stopPropagation();
        if (!target) return;
        update.mutate({
          task,
          patch: { status_id: target.id },
          optimistic: { completed_at: done ? null : new Date().toISOString() },
          failure: done ? "Couldn't reopen the task" : "Couldn't complete the task",
        });
      }}
      className={cn(
        "group/check inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-[var(--dur-fast)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default",
        size === "sm" ? "size-3.5" : "size-4",
      )}
      style={done ? { backgroundColor: color, borderColor: color } : { borderColor: color }}
    >
      <Check
        className={cn(
          "size-2.5 transition-opacity",
          done ? "text-white opacity-100" : "text-fg-faint opacity-0 group-enabled/check:group-hover/check:opacity-100",
        )}
        strokeWidth={3}
        aria-hidden
      />
    </button>
  );
}

/* ---------- Priority ---------- */

export function PriorityControl({
  task,
  disabled,
  iconOnly,
  quiet,
  className,
}: {
  task: Task;
  disabled?: boolean;
  iconOnly?: boolean;
  /** Dense rows: normal and low only show on hover; urgent and high always show. */
  quiet?: boolean;
  className?: string;
}) {
  const update = useUpdateTask();
  const hide = quiet && (task.priority === "normal" || task.priority === "low");
  const badge = <PriorityBadge priority={task.priority} iconOnly={iconOnly} />;
  if (disabled) return <span className={cn("inline-flex h-7 items-center px-1", hide && reveal, className)}>{badge}</span>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(triggerBase, hide && reveal, className)} aria-label={`Priority: ${priorityLabel(task.priority)}. Change priority`}>
        {badge}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-40">
        <DropdownMenuLabel>Priority</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={task.priority}
          onValueChange={(p) =>
            p !== task.priority &&
            update.mutate({ task, patch: { priority: p as Priority }, failure: "Couldn't change the priority" })
          }
        >
          {PRIORITIES.map((p) => (
            <DropdownMenuRadioItem key={p} value={p}>
              <PriorityBadge priority={p} className="text-13 text-fg" />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------- Assignees ---------- */

export function AssigneeControl({
  task,
  users,
  disabled,
  compact,
  className,
}: {
  task: Task;
  users: UserSummary[];
  disabled?: boolean;
  /** Avatars only (dense rows). */
  compact?: boolean;
  className?: string;
}) {
  const set = useSetAssignees();
  if (disabled) {
    return task.assignees.length ? (
      <span className={cn("inline-flex h-7 items-center gap-2 px-1 text-13", className)}>
        <AvatarStack users={task.assignees} size="xs" max={3} />
        {!compact && (
          <span className="truncate">
            {task.assignees.length === 1 ? task.assignees[0].full_name || task.assignees[0].email : `${task.assignees.length} people`}
          </span>
        )}
      </span>
    ) : (
      <span className={cn("inline-flex h-7 items-center px-1 text-13 text-fg-faint", className)}>
        {compact ? <span className="sr-only">Unassigned</span> : "Unassigned"}
      </span>
    );
  }
  // Keep people already assigned in the list even if they lost project access.
  const pool = [...users, ...task.assignees.filter((a) => !users.some((u) => u.id === a.id))];
  return (
    <UserPicker
      users={pool}
      value={task.assignees.map((a) => a.id)}
      onChange={(ids) =>
        set.mutate({ task, users: ids.map((id) => pool.find((u) => u.id === id)).filter((u): u is UserSummary => Boolean(u)) })
      }
      placeholder={compact ? "" : "Assign"}
      className={cn(
        "h-7 gap-1.5 border-transparent bg-transparent px-1 hover:bg-hover data-[state=open]:border-transparent data-[state=open]:bg-active",
        compact && "[&>span:last-child]:hidden",
        compact && task.assignees.length === 0 && reveal,
        className,
      )}
    />
  );
}

/** Placeholder icon for an empty compact assignee cell. */
export function UnassignedIcon() {
  return <UserPlus className="size-4 text-fg-faint" aria-hidden />;
}

/* ---------- Due date ---------- */

export function DueControl({
  task,
  disabled,
  variant = "inline",
  emptyLabel = "",
  revealEmpty,
  className,
}: {
  task: Task;
  disabled?: boolean;
  variant?: "inline" | "field";
  emptyLabel?: string;
  /** Dense rows: an empty date shows a calendar icon on hover instead of text. */
  revealEmpty?: boolean;
  className?: string;
}) {
  const update = useUpdateTask();
  const tone = dueTone(task);
  if (disabled && !task.due_at && revealEmpty) return null;
  if (!task.due_at && revealEmpty && !disabled) {
    return (
      <DueDatePicker
        value={null}
        hasTime={false}
        variant="inline"
        aria-label="Set due date"
        label={<CalendarPlus className="size-4 text-fg-faint" aria-hidden />}
        triggerClassName={cn(reveal, className)}
        onChange={(d, hasTime) =>
          d &&
          update.mutate({
            task,
            patch: { due_at: hasTime ? withTimeIso(d, d.getHours(), d.getMinutes()) : dateOnlyIso(d), due_has_time: hasTime },
            failure: "Couldn't set the due date",
          })
        }
      />
    );
  }
  return (
    <DueDatePicker
      value={dueDate(task)}
      hasTime={task.due_has_time}
      variant={variant}
      disabled={disabled}
      placeholder={emptyLabel || "Set due date"}
      label={task.due_at ? formatDue(task, { long: variant === "field" }) : emptyLabel || undefined}
      triggerClassName={cn(task.due_at && DUE_TONE_CLASS[tone], tone === "overdue" && "font-medium", className)}
      onChange={(d, hasTime) =>
        update.mutate({
          task,
          patch: d
            ? { due_at: hasTime ? withTimeIso(d, d.getHours(), d.getMinutes()) : dateOnlyIso(d), due_has_time: hasTime }
            : { due_at: null, due_has_time: false },
          failure: "Couldn't change the due date",
        })
      }
    />
  );
}

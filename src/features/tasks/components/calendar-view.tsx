"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  isWeekend,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarX2, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { Task } from "@/lib/api/types";
import { useStoredState } from "@/lib/hooks/use-stored-state";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { useUpdateTask } from "../api";
import { dayKey, formatDue, moveDueToDay } from "../lib/dates";
import { isDoneCategory } from "../lib/groups";
import type { ScopeData } from "../lib/use-scope-data";
import { useTaskLink } from "../lib/use-task-filters";

/*
 * Calendar by due date. Month or week. Drag a card to another day to move its due date (a timed
 * due date keeps its time), or to the tray to clear it. Keyboard: focus a card, Space to pick
 * up, arrows to move between days, Space to drop.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const noop = () => () => {};

/** Pointer position when there is one; the dragged card's rectangle for keyboard drags. */
const collide: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

export function CalendarView({ data, tasks }: { data: ScopeData; tasks: Task[] }) {
  const update = useUpdateTask();
  const [mode, setMode] = useStoredState<"month" | "week">("ahead-one.calendar-mode", "month");
  // The anchor is read in the browser only, so prerender never bakes in a date.
  const now = useSyncExternalStore(noop, () => format(new Date(), "yyyy-MM-dd"), () => "");
  const [offset, setOffset] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);

  const anchor = useMemo(() => {
    const base = now ? new Date(`${now}T12:00:00`) : new Date(2000, 0, 1);
    return mode === "month" ? addMonths(base, offset) : addWeeks(base, offset);
  }, [now, offset, mode]);

  const days = useMemo(() => {
    const start = mode === "month" ? startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }) : startOfWeek(anchor, { weekStartsOn: 1 });
    const end = mode === "month" ? endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }) : endOfWeek(anchor, { weekStartsOn: 1 });
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [anchor, mode]);

  const { byDay, unscheduled } = useMemo(() => {
    const m = new Map<string, Task[]>();
    const none: Task[] = [];
    for (const t of tasks) {
      if (!t.due_at) {
        none.push(t);
        continue;
      }
      const k = dayKey(new Date(t.due_at));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    for (const list of m.values()) list.sort((a, b) => (a.due_at! < b.due_at! ? -1 : 1));
    return { byDay: m, unscheduled: none };
  }, [tasks]);

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const task = byId.get(String(e.active.id));
    const over = e.over ? String(e.over.id) : null;
    if (!task || !over) return;
    if (over === "unscheduled") {
      if (task.due_at) update.mutate({ task, patch: { due_at: null, due_has_time: false }, failure: "Couldn't clear the due date" });
      return;
    }
    const day = new Date(`${over}T12:00:00`);
    if (task.due_at && dayKey(new Date(task.due_at)) === over) return;
    const patch = moveDueToDay(task, day);
    update.mutate({ task, patch, failure: "Couldn't move the due date" });
  }

  const title = mode === "month" ? format(anchor, "MMMM yyyy") : `${format(days[0], "MMM d")} to ${format(days[6], "MMM d, yyyy")}`;
  const active = activeId ? byId.get(activeId) : undefined;
  const canMove = data.access.canEdit;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collide}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable: "To move a due date, press Space, use the arrow keys to choose a day, then press Space again.",
        },
      }}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-14 font-semibold text-fg" aria-live="polite">
              {title || "Calendar"}
            </h2>
            <div className="inline-flex h-7 items-center rounded-sm bg-surface-sunken p-0.5" role="radiogroup" aria-label="Calendar range">
              {(["month", "week"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => {
                    setMode(m);
                    setOffset(0);
                  }}
                  className={cn(
                    "h-6 rounded-xs px-2 text-12 font-medium capitalize focus-visible:outline-2 focus-visible:outline-ring",
                    mode === m ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={() => setOffset(0)}>
              Today
            </Button>
            <div className="flex">
              <button
                type="button"
                aria-label={mode === "month" ? "Previous month" : "Previous week"}
                onClick={() => setOffset((o) => o - 1)}
                className="inline-flex size-7 items-center justify-center rounded-sm text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={mode === "month" ? "Next month" : "Next week"}
                onClick={() => setOffset((o) => o + 1)}
                className="inline-flex size-7 items-center justify-center rounded-sm text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          <div className={cn(mode === "month" && "overflow-x-auto")}>
            <div
              className={cn(
                "overflow-hidden rounded-md border border-border",
                mode === "month" ? "min-w-[700px]" : "",
              )}
            >
              <div className={cn("grid-cols-7 border-b border-border bg-surface-sunken", mode === "month" ? "grid" : "hidden sm:grid")}>
                {WEEKDAYS.map((d) => (
                  <span key={d} className="px-2 py-1.5 text-12 text-fg-muted">
                    {d}
                  </span>
                ))}
              </div>
              <div className={cn("grid", mode === "month" ? "grid-cols-7" : "grid-cols-1 sm:grid-cols-7")}>
                {days.map((d) => (
                  <DayCell
                    key={dayKey(d)}
                    day={d}
                    mode={mode}
                    inMonth={mode === "week" || isSameMonth(d, anchor)}
                    tasks={byDay.get(dayKey(d)) ?? []}
                    data={data}
                    canMove={canMove}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <Tray tasks={unscheduled} data={data} canMove={canMove} />
      </div>
      <DragOverlay dropAnimation={null}>{active ? <Card task={active} data={data} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function DayCell({
  day,
  mode,
  inMonth,
  tasks,
  data,
  canMove,
}: {
  day: Date;
  mode: "month" | "week";
  inMonth: boolean;
  tasks: Task[];
  data: ScopeData;
  canMove: boolean;
}) {
  const key = dayKey(day);
  const { setNodeRef, isOver } = useDroppable({ id: key });
  const max = mode === "month" ? 3 : Infinity;
  const shown = tasks.slice(0, max);
  const rest = tasks.length - shown.length;
  const today = isToday(day);
  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={`${format(day, "EEEE, MMMM d")}, ${tasks.length} tasks`}
      className={cn(
        "flex flex-col gap-1 border-b border-r border-border-subtle p-1 transition-colors duration-[var(--dur-fast)] [&:nth-child(7n)]:border-r-0",
        mode === "month" ? "min-h-[112px]" : "min-h-[72px] sm:min-h-[360px]",
        isWeekend(day) ? "bg-surface-sunken/60" : "bg-surface",
        isOver && "bg-accent-subtle",
      )}
    >
      <div className="flex items-center gap-2 px-1 pt-0.5">
        <span
          className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-12 tabular",
            today ? "bg-accent font-semibold text-fg-on-accent" : inMonth ? "text-fg" : "text-fg-faint",
          )}
        >
          {format(day, "d")}
        </span>
        {mode === "week" && <span className="text-12 text-fg-muted sm:hidden">{format(day, "EEEE")}</span>}
      </div>
      {shown.map((t) => (
        <DraggableCard key={t.id} task={t} data={data} canMove={canMove} />
      ))}
      {rest > 0 && (
        <Popover>
          <PopoverTrigger className="h-6 rounded-xs px-1.5 text-left text-12 font-medium text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring">
            {rest} more
          </PopoverTrigger>
          <PopoverContent className="flex w-64 flex-col gap-1 p-2" aria-label={format(day, "MMMM d")}>
            <p className="px-1 pb-1 text-12 font-medium text-fg-muted">{format(day, "EEEE, MMMM d")}</p>
            {tasks.map((t) => (
              <Card key={t.id} task={t} data={data} />
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function DraggableCard({ task, data, canMove }: { task: Task; data: ScopeData; canMove: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !canMove });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription={canMove ? "Draggable task" : undefined}
      aria-label={`${task.title}${task.due_at ? `, due ${formatDue(task)}` : ""}`}
      className={cn(
        "rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-ring",
        isDragging && "opacity-40",
      )}
    >
      <Card task={task} data={data} />
    </div>
  );
}

function Card({ task, data, overlay }: { task: Task; data: ScopeData; overlay?: boolean }) {
  const link = useTaskLink();
  const status = data.statusById.get(task.status_id);
  const done = isDoneCategory(status?.category) || Boolean(task.completed_at);
  return (
    <div
      className={cn(
        "flex h-6 min-w-0 items-center gap-1.5 rounded-xs border border-border bg-surface px-1.5 text-12",
        overlay && "w-48 shadow-popover",
      )}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={done ? { backgroundColor: status?.color } : { boxShadow: `inset 0 0 0 1.5px ${status?.color ?? "var(--fg-faint)"}` }}
      />
      <Link
        href={link.href(task.id)}
        scroll={false}
        tabIndex={-1}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn("min-w-0 flex-1 truncate hover:underline", done ? "text-fg-muted line-through" : "text-fg")}
      >
        {task.title}
      </Link>
      {task.due_has_time && task.due_at && (
        <span className="shrink-0 text-11 text-fg-faint tabular">{format(new Date(task.due_at), "h:mma").toLowerCase()}</span>
      )}
    </div>
  );
}

function Tray({ tasks, data, canMove }: { tasks: Task[]; data: ScopeData; canMove: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "unscheduled" });
  return (
    <aside
      ref={setNodeRef}
      aria-label={`Unscheduled, ${tasks.length} tasks`}
      className={cn(
        "flex shrink-0 flex-col gap-1 rounded-md border border-border bg-surface-sunken p-2 transition-colors duration-[var(--dur-fast)] lg:sticky lg:top-2 lg:w-60",
        isOver && "border-ring bg-accent-subtle",
      )}
    >
      <h3 className="flex items-center justify-between px-1 pb-1 text-13 font-semibold text-fg">
        Unscheduled <span className="text-12 font-normal text-fg-faint tabular">{tasks.length}</span>
      </h3>
      {tasks.length === 0 ? (
        <p className="flex flex-col items-center gap-1.5 px-2 py-6 text-center text-12 text-fg-muted">
          <CalendarX2 className="size-4 text-fg-faint" aria-hidden />
          Every task has a due date. Drag one here to clear its date.
        </p>
      ) : (
        <div className="flex max-h-[480px] flex-col gap-1 overflow-y-auto">
          {tasks.map((t) => (
            <DraggableCard key={t.id} task={t} data={data} canMove={canMove} />
          ))}
        </div>
      )}
    </aside>
  );
}

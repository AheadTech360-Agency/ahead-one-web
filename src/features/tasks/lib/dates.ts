import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameYear,
  isToday,
  isTomorrow,
  isYesterday,
  startOfDay,
} from "date-fns";
import type { Task } from "@/lib/api/types";

/**
 * Due dates. A date-only due date is stored as 23:59 local time with due_has_time=false and
 * is always shown without a time. A timed due date keeps the minute the person picked.
 */

export function dateOnlyIso(day: Date): string {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 0, 0).toISOString();
}

export function withTimeIso(day: Date, hours: number, minutes: number): string {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0, 0).toISOString();
}

/** The patch for moving a due date to another day, keeping the time of day when there is one. */
export function moveDueToDay(task: Pick<Task, "due_at" | "due_has_time">, day: Date) {
  if (task.due_at && task.due_has_time) {
    const d = new Date(task.due_at);
    return { due_at: withTimeIso(day, d.getHours(), d.getMinutes()), due_has_time: true };
  }
  return { due_at: dateOnlyIso(day), due_has_time: false };
}

export function dueDate(task: Pick<Task, "due_at">): Date | null {
  return task.due_at ? new Date(task.due_at) : null;
}

/** Short relative label: Today, Tomorrow, Yesterday, weekday within a week, else the date. */
export function formatDue(task: Pick<Task, "due_at" | "due_has_time">, opts: { long?: boolean } = {}): string {
  const d = dueDate(task);
  if (!d) return "";
  let day: string;
  if (isToday(d)) day = "Today";
  else if (isTomorrow(d)) day = "Tomorrow";
  else if (isYesterday(d)) day = "Yesterday";
  else {
    const diff = differenceInCalendarDays(d, new Date());
    if (!opts.long && diff > 0 && diff < 7) day = format(d, "EEE");
    else day = format(d, isSameYear(d, new Date()) ? (opts.long ? "EEE, MMM d" : "MMM d") : "MMM d, yyyy");
  }
  return task.due_has_time ? `${day}, ${format(d, "h:mm a")}` : day;
}

export type DueTone = "overdue" | "today" | "soon" | "normal" | "none";

export function dueTone(task: Pick<Task, "due_at" | "due_has_time" | "completed_at">): DueTone {
  const d = dueDate(task);
  if (!d) return "none";
  if (task.completed_at) return "normal";
  const now = new Date();
  const overdue = task.due_has_time ? d < now : startOfDay(d) < startOfDay(now);
  if (overdue) return "overdue";
  if (isToday(d)) return "today";
  if (d < addDays(startOfDay(now), 3)) return "soon";
  return "normal";
}

export const DUE_TONE_CLASS: Record<DueTone, string> = {
  overdue: "text-danger-text",
  today: "text-warning-text",
  soon: "text-fg",
  normal: "text-fg-muted",
  none: "text-fg-faint",
};

/** Local calendar key, used to bucket tasks into calendar cells. */
export function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 86400 * 6) return `${Math.round(diff / 86400)}d ago`;
  return format(d, isSameYear(d, new Date()) ? "MMM d" : "MMM d, yyyy");
}

export function absoluteTime(iso: string): string {
  return format(new Date(iso), "MMM d, yyyy 'at' h:mm a");
}

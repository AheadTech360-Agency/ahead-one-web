"use client";

import { addDays, format, parseISO } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { Priority, SortDir, TaskSort } from "@/lib/api/types";
import type { TaskFilters } from "../api";

/*
 * Filters live in the URL so a filtered view can be shared. Multi-values are comma separated,
 * exactly as the API takes them. Due range is stored as local yyyy-MM-dd days and converted to
 * instants for the API (due_to is exclusive, so it becomes the start of the following day).
 */

export const SORTS: { value: TaskSort; label: string }[] = [
  { value: "position", label: "Manual order" },
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Last updated" },
  { value: "title", label: "Title" },
];

export type FilterState = {
  assignee: string[];
  status: string[];
  priority: Priority[];
  dueFrom: string | null;
  dueTo: string | null;
  sort: TaskSort;
  dir: SortDir;
  hideDone: boolean;
};

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);
const SORT_VALUES = new Set(SORTS.map((s) => s.value));
const PRIORITY_VALUES = new Set(["urgent", "high", "normal", "low"]);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function useTaskFilters() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const state = useMemo<FilterState>(() => {
    const sort = params.get("sort");
    const from = params.get("due_from");
    const to = params.get("due_to");
    return {
      assignee: list(params.get("assignee")),
      status: list(params.get("status")),
      priority: list(params.get("priority")).filter((p) => PRIORITY_VALUES.has(p)) as Priority[],
      dueFrom: from && DAY.test(from) ? from : null,
      dueTo: to && DAY.test(to) ? to : null,
      sort: sort && SORT_VALUES.has(sort as TaskSort) ? (sort as TaskSort) : "position",
      dir: params.get("dir") === "desc" ? "desc" : "asc",
      hideDone: params.get("done") === "hide",
    };
  }, [params]);

  const query = useMemo<TaskFilters>(() => {
    const q: TaskFilters = {};
    if (state.assignee.length) q.assignee = state.assignee.join(",");
    if (state.status.length) q.status = state.status.join(",");
    if (state.priority.length) q.priority = state.priority.join(",");
    if (state.dueFrom) q.due_from = parseISO(state.dueFrom).toISOString();
    if (state.dueTo) q.due_to = addDays(parseISO(state.dueTo), 1).toISOString();
    if (state.sort !== "position") q.sort = state.sort;
    if (state.dir !== "asc") q.dir = state.dir;
    if (state.hideDone) q.include_done = false;
    return q;
  }, [state]);

  const update = useCallback(
    (patch: Partial<FilterState>) => {
      const next = new URLSearchParams(params.toString());
      const set = (k: string, v: string | null | undefined) => (v ? next.set(k, v) : next.delete(k));
      if (patch.assignee) set("assignee", patch.assignee.join(","));
      if (patch.status) set("status", patch.status.join(","));
      if (patch.priority) set("priority", patch.priority.join(","));
      if ("dueFrom" in patch) set("due_from", patch.dueFrom);
      if ("dueTo" in patch) set("due_to", patch.dueTo);
      if (patch.sort) set("sort", patch.sort === "position" ? null : patch.sort);
      if (patch.dir) set("dir", patch.dir === "asc" ? null : patch.dir);
      if ("hideDone" in patch) set("done", patch.hideDone ? "hide" : null);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const clear = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    for (const k of ["assignee", "status", "priority", "due_from", "due_to", "done"]) next.delete(k);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  const activeCount =
    (state.assignee.length ? 1 : 0) +
    (state.status.length ? 1 : 0) +
    (state.priority.length ? 1 : 0) +
    (state.dueFrom || state.dueTo ? 1 : 0) +
    (state.hideDone ? 1 : 0);

  return { state, query, update, clear, activeCount };
}

export function dayParam(d: Date) {
  return format(d, "yyyy-MM-dd");
}

/** Open a task in the slide-over by adding ?task= to the current URL. */
export function useTaskLink() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const href = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (id) next.set("task", id);
      else next.delete("task");
      const qs = next.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [params, pathname],
  );
  const open = useCallback((id: string) => router.push(href(id), { scroll: false }), [href, router]);
  const close = useCallback(() => router.push(href(null), { scroll: false }), [href, router]);
  return { open, close, href, current: params.get("task") };
}

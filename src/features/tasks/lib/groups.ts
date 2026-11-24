import type { List, ListStatus, StatusCategory, Task } from "@/lib/api/types";

/**
 * Status groups. A list view groups by its own statuses; a project view merges the statuses of
 * all its lists by name (case-insensitive), so "In review" in two lists is one column.
 */
export type StatusGroup = {
  key: string;
  name: string;
  color: string;
  category: StatusCategory;
  /** The status with this name in each list that has one. */
  byList: Map<string, ListStatus>;
  statusIds: string[];
};

export function groupKey(name: string) {
  return name.trim().toLowerCase();
}

export function buildGroups(statuses: ListStatus[], lists?: Pick<List, "id">[]): StatusGroup[] {
  const order = lists ? new Map(lists.map((l, i) => [l.id, i])) : null;
  // Server order is position order within a list; keep it (stable sort) and only order by list.
  const sorted = order
    ? [...statuses].sort((a, b) => (order.get(a.list_id) ?? 0) - (order.get(b.list_id) ?? 0))
    : statuses;
  const groups = new Map<string, StatusGroup>();
  for (const s of sorted) {
    const key = groupKey(s.name);
    let g = groups.get(key);
    if (!g) {
      g = { key, name: s.name, color: s.color, category: s.category, byList: new Map(), statusIds: [] };
      groups.set(key, g);
    }
    if (!g.byList.has(s.list_id)) g.byList.set(s.list_id, s);
    g.statusIds.push(s.id);
  }
  return [...groups.values()];
}

export function statusIndex(statuses: ListStatus[]) {
  return new Map(statuses.map((s) => [s.id, s]));
}

export function groupOfTask(task: Task, byId: Map<string, ListStatus>): string | undefined {
  const s = byId.get(task.status_id);
  return s ? groupKey(s.name) : undefined;
}

export function isDoneCategory(c: StatusCategory | undefined) {
  return c === "done" || c === "closed";
}

/** Statuses of one list, in the server's position order. */
export function statusesOfList(statuses: ListStatus[], listId: string) {
  return statuses.filter((s) => s.list_id === listId);
}

/** First status in the "done" category for a list, for the complete toggle. */
export function doneStatusFor(statuses: ListStatus[], listId: string) {
  const own = statusesOfList(statuses, listId);
  return own.find((s) => s.category === "done") ?? own.find((s) => s.category === "closed");
}

export function openStatusFor(statuses: ListStatus[], listId: string) {
  const own = statusesOfList(statuses, listId);
  return own.find((s) => s.category === "todo") ?? own.find((s) => s.category === "active") ?? own[0];
}

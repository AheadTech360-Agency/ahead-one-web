/*
 * Pure rules for the team dashboards: which dashboard a role gets, how the client scope is read
 * from the URL, how timeline tasks are grouped and how numbers are written. No React, no "@/"
 * imports, so `npm test` runs it under node:test.
 */

export type Role = "owner" | "admin" | "management" | "member" | "guest";
export type DashboardKind = "personal" | "operations" | "executive";

/**
 * Which Home a role sees. The API enforces access; this only decides what to render and whether to
 * ask for the team dashboard at all (Member and Guest get a 403 there, so they never request it).
 */
export function dashboardKind(role: Role | undefined): DashboardKind {
  if (role === "owner") return "executive";
  if (role === "admin" || role === "management") return "operations";
  return "personal";
}

export const canSeeTeamDashboard = (role: Role | undefined) => dashboardKind(role) !== "personal";

export type ViewMode = "complete" | "client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The `?client=` value when it looks like a space id; anything else means the complete view. */
export function parseClientParam(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  return UUID.test(raw) ? raw.toLowerCase() : undefined;
}

type ClientLike = { space_id: string };

/**
 * The client to scope to: only one the API listed for this person. An id that is not in the list
 * (removed, or not theirs) falls back to the complete view, so the UI never shows a client the API
 * did not return. While the list is unknown the id is kept so the request can start early.
 */
export function resolveClient(param: string | undefined, clients: readonly ClientLike[] | undefined): string | undefined {
  if (!param) return undefined;
  if (!clients) return param;
  return clients.some((c) => c.space_id.toLowerCase() === param) ? param : undefined;
}

export function viewMode(clientId: string | undefined): ViewMode {
  return clientId ? "client" : "complete";
}

/** Build the href for a view, keeping other params. */
export function viewHref(pathname: string, search: string, clientId: string | undefined): string {
  const p = new URLSearchParams(search);
  if (clientId) p.set("client", clientId);
  else p.delete("client");
  const q = p.toString();
  return q ? `${pathname}?${q}` : pathname;
}

/* ---------- Timeline ---------- */

export type TimelineKey = "overdue" | "today" | "tomorrow" | "this_week";
export const TIMELINE_KEYS: readonly TimelineKey[] = ["overdue", "today", "tomorrow", "this_week"];
export const TIMELINE_LABEL: Record<TimelineKey, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "This week",
};

const DAY = 86_400_000;

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Which bucket a due date belongs to, relative to `now` in local time: before today is overdue,
 * then today, tomorrow, and the following days through the next 7 days from today are "this week".
 * Null when it is further out.
 */
export function timelineBucket(dueAt: string, now: Date): TimelineKey | null {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const today = startOfLocalDay(now);
  const dueDay = startOfLocalDay(due);
  const diff = Math.round((dueDay - today) / DAY);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "this_week";
  return null;
}

export type TimelineGroup<T> = { total: number; items: T[] };

/** Group tasks into the four timeline buckets, oldest due first, capped to `cap` items per bucket. */
export function groupTimeline<T extends { due_at: string }>(
  tasks: readonly T[],
  now: Date,
  cap = 8,
): Record<TimelineKey, TimelineGroup<T>> {
  const out: Record<TimelineKey, TimelineGroup<T>> = {
    overdue: { total: 0, items: [] },
    today: { total: 0, items: [] },
    tomorrow: { total: 0, items: [] },
    this_week: { total: 0, items: [] },
  };
  const sorted = [...tasks].sort((a, b) => a.due_at.localeCompare(b.due_at));
  for (const t of sorted) {
    const k = timelineBucket(t.due_at, now);
    if (!k) continue;
    const g = out[k];
    g.total += 1;
    if (g.items.length < cap) g.items.push(t);
  }
  return out;
}

/* ---------- Numbers ---------- */

/** 1,234 below ten thousand, then 12.4k and 1.2M. */
export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs < 10_000) return Math.round(n).toLocaleString("en-US");
  if (abs < 1_000_000) return `${trim(n / 1_000)}k`;
  return `${trim(n / 1_000_000)}M`;
}

function trim(v: number): string {
  const s = Math.abs(v) < 100 ? v.toFixed(1) : Math.round(v).toString();
  return s.replace(/\.0$/, "");
}

/** Decimal units (KB = 1000) like the Files screen. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i += 1;
  }
  const digits = i === 0 || v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1")} ${units[i]}`;
}

export type Delta = { direction: "up" | "down" | "flat"; text: string; abs: number };

/** This week against last week: "+4 vs last week", "-2 vs last week" or "same as last week". */
export function weekDelta(current: number, previous: number): Delta {
  const diff = current - previous;
  if (diff === 0) return { direction: "flat", text: "Same as last week", abs: 0 };
  const sign = diff > 0 ? "+" : "-";
  return { direction: diff > 0 ? "up" : "down", text: `${sign}${Math.abs(diff)} vs last week`, abs: Math.abs(diff) };
}

/** Whole-number percentage, 0 when the whole is 0. */
export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

/** Evenly spaced points for a sparkline-style area chart in a w x h box. */
export function chartPoints(values: readonly number[], w: number, h: number, pad = 2): { x: number; y: number }[] {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  return values.map((v, i) => ({ x: i * step, y: pad + (h - pad * 2) * (1 - v / max) }));
}

/* ---------- Activity wording ---------- */

const ACTIVITY_VERB: Record<string, string> = {
  created: "created",
  title_changed: "renamed",
  description_changed: "edited the description of",
  status_changed: "moved",
  priority_changed: "changed the priority of",
  due_changed: "changed the due date of",
  assignees_changed: "changed the assignees of",
  completed: "completed",
  reopened: "reopened",
  comment_added: "commented on",
  attachment_added: "attached a file to",
  deleted: "deleted",
};

/** "completed" for kind "completed"; unknown kinds read as "updated" so a new server kind never shows raw. */
export function activityVerb(kind: string): string {
  return ACTIVITY_VERB[kind] ?? "updated";
}

/** Short relative time: "now", "5m", "3h", "2d". */
export function ago(iso: string, now: Date): string {
  const s = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86_400)}d`;
}

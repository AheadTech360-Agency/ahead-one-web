"use client";

import { format } from "date-fns";
import { CalendarCheck, CircleAlert, FolderKanban, History, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { intent, usePrefetchers } from "@/lib/api/prefetch";
import type { TeamActivityItem, TeamProjectRow, TeamWorkloadRow, UserSummary } from "@/lib/api/types";
import { useTaskLink } from "@/features/tasks/lib/use-task-filters";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { EmptyState } from "@/ui/empty-state";
import { Tooltip } from "@/ui/tooltip";
import type { ClientSummary, Timeline, TimelineTask } from "@/lib/api/types";
import { activityVerb, ago, percent, TIMELINE_KEYS, TIMELINE_LABEL, type TimelineKey } from "../lib/logic";
import { ClientDot } from "./primitives";

const noopSub = () => () => {};
/** A stable "now" for relative times, read in the browser only (prerender never bakes in a time). */
function useNow(): Date | null {
  const stamp = useSyncExternalStore(noopSub, () => Math.floor(Date.now() / 60_000), () => 0);
  return useMemo(() => (stamp ? new Date(stamp * 60_000) : null), [stamp]);
}

/* ---------- Workload: who is assigned what ---------- */

const col = "grid grid-cols-[minmax(0,1fr)_52px_64px_52px] items-center gap-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_52px_64px_52px] sm:gap-3";

export function WorkloadPanel({ rows, unassigned, className }: { rows: TeamWorkloadRow[]; unassigned: number; className?: string }) {
  const sorted = useMemo(() => [...rows].sort((a, b) => b.open - a.open || b.overdue - a.overdue), [rows]);
  const max = Math.max(1, unassigned, ...sorted.map((r) => r.open));
  return (
    <div className={className}>
      {sorted.length === 0 && unassigned === 0 ? (
        <EmptyState compact icon={Users} title="No open work is assigned" description="Tasks show here as soon as they have an assignee." />
      ) : (
        <div role="table" aria-label="Tasks per member">
          <div role="row" className={cn(col, "border-b border-border-subtle px-4 py-2 text-11 font-medium uppercase tracking-[0.04em] text-fg-faint")}>
            <span role="columnheader">Member</span>
            <span role="columnheader" className="hidden sm:block">
              Open work
            </span>
            <span role="columnheader" className="text-right">
              Open
            </span>
            <span role="columnheader" className="text-right">
              Overdue
            </span>
            <span role="columnheader" className="text-right">
              Done 7d
            </span>
          </div>
          <ul className="m-0 list-none p-0">
            {sorted.map((r) => {
              const name = r.user.full_name || r.user.email;
              const onTime = Math.max(0, r.open - r.overdue);
              return (
                <li key={r.user.id} role="row" className={cn(col, "border-b border-border-subtle px-4 py-2.5 last:border-b-0 hover:bg-hover")}>
                  <span role="cell" className="flex min-w-0 items-center gap-2.5">
                    <Avatar user={r.user} size="sm" decorative />
                    <span className="truncate text-13 font-medium text-fg">{name}</span>
                  </span>
                  <span role="cell" aria-hidden className="hidden h-2 items-center gap-px sm:flex">
                    <span className="flex h-full w-full items-center gap-px">
                      {onTime > 0 && <span className="h-full rounded-l-[3px] bg-chart-1" style={{ width: `${(onTime / max) * 100}%` }} />}
                      {r.overdue > 0 && <span className="h-full rounded-r-[3px] bg-chart-3" style={{ width: `${(r.overdue / max) * 100}%` }} />}
                    </span>
                  </span>
                  <span role="cell" className={cn("text-right text-13 tabular", r.open ? "font-medium text-fg" : "text-fg-faint")}>
                    {r.open}
                  </span>
                  <span role="cell" className={cn("text-right text-13 tabular", r.overdue ? "font-medium text-danger-text" : "text-fg-faint")}>
                    {r.overdue}
                  </span>
                  <span role="cell" className={cn("text-right text-13 tabular", r.done_7d ? "text-success-text" : "text-fg-faint")}>
                    {r.done_7d}
                  </span>
                </li>
              );
            })}
            <li role="row" className={cn(col, "border-t border-border bg-surface-sunken px-4 py-2.5")}>
              <span role="cell" className="flex min-w-0 items-center gap-2.5">
                <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-full border border-dashed border-border-strong text-fg-faint">
                  ?
                </span>
                <span className="truncate text-13 font-medium text-fg">Unassigned</span>
              </span>
              <span role="cell" aria-hidden className="hidden h-2 items-center sm:flex">
                <span className="h-full rounded-[3px] bg-border-strong" style={{ width: `${(unassigned / max) * 100}%` }} />
              </span>
              <span role="cell" className={cn("text-right text-13 tabular", unassigned ? "font-medium text-warning-text" : "text-fg-faint")}>
                {unassigned}
              </span>
              <span role="cell" className="text-right text-13 text-fg-faint">
                -
              </span>
              <span role="cell" className="text-right text-13 text-fg-faint">
                -
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------- Timeline ---------- */

export function TimelinePanel({ timeline, clients, className }: { timeline: Timeline; clients?: ClientSummary[]; className?: string }) {
  const colors = new Map((clients ?? []).map((c) => [c.space_id, c.color]));
  const colorOf = (id: string) => colors.get(id) ?? "var(--color-border-strong)";
  const all = TIMELINE_KEYS.reduce((n, k) => n + timeline[k].total, 0);
  if (all === 0) {
    return <EmptyState compact icon={CalendarCheck} title="Nothing due in the next week" description="Dated tasks appear here, grouped by when they are due." className={className} />;
  }
  return (
    <div className={className}>
      {TIMELINE_KEYS.map((k) => (
        <TimelineGroup key={k} k={k} bucket={timeline[k]} colorOf={colorOf} />
      ))}
    </div>
  );
}

function TimelineGroup({ k, bucket, colorOf }: { k: TimelineKey; bucket: Timeline[TimelineKey]; colorOf: (spaceId: string) => string }) {
  const late = k === "overdue";
  return (
    <section aria-label={TIMELINE_LABEL[k]} className="border-b border-border-subtle last:border-b-0">
      <h3 className="flex items-center gap-2 px-4 pb-1 pt-3 text-11 font-semibold uppercase tracking-[0.05em]">
        <span aria-hidden className={cn("size-1.5 rounded-full", late ? "bg-chart-3" : k === "today" ? "bg-green" : "bg-border-strong")} />
        <span className={late && bucket.total ? "text-danger-text" : "text-fg-muted"}>{TIMELINE_LABEL[k]}</span>
        <span className="font-medium tabular text-fg-faint">{bucket.total}</span>
      </h3>
      {bucket.tasks.length === 0 ? (
        <p className="px-4 pb-3 text-12 text-fg-faint">{late ? "Nothing overdue." : "Nothing due."}</p>
      ) : (
        <ul className="m-0 list-none p-0 pb-1">
          {bucket.tasks.map((t) => (
            <TimelineRow key={t.task_id} t={t} late={late} color={colorOf(t.space_id)} />
          ))}
          {bucket.total > bucket.tasks.length && (
            <li className="px-4 pb-2 pt-1 text-12 text-fg-muted tabular">and {bucket.total - bucket.tasks.length} more</li>
          )}
        </ul>
      )}
    </section>
  );
}

function TimelineRow({ t, late, color }: { t: TimelineTask; late: boolean; color: string }) {
  const link = useTaskLink();
  const pf = usePrefetchers();
  return (
    <li>
      <Link
        href={link.href(t.task_id)}
        scroll={false}
        {...intent(() => pf.task(t.task_id))}
        className="group flex items-center gap-3 px-4 py-2 outline-none hover:bg-hover focus-visible:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-13 font-medium text-fg group-hover:underline">{t.title}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-12 text-fg-muted">
            <ClientDot color={color} />
            <span className="truncate">
              {t.space_name}
              <span className="text-fg-faint"> / </span>
              {t.project_name}
            </span>
          </span>
        </span>
        <span className={cn("shrink-0 text-12 tabular", late ? "font-medium text-danger-text" : "text-fg-muted")}>{format(new Date(t.due_date), "EEE d")}</span>
        <AvatarStack users={t.assignees} />
      </Link>
    </li>
  );
}

export function AvatarStack({ users, max = 3 }: { users: UserSummary[]; max?: number }) {
  if (users.length === 0) {
    return (
      <span className="inline-flex h-6 w-12 shrink-0 items-center justify-end text-11 text-fg-faint" aria-label="Unassigned">
        none
      </span>
    );
  }
  const shown = users.slice(0, max);
  return (
    <Tooltip content={users.map((u) => u.full_name || u.email).join(", ")}>
      <span className="flex shrink-0 items-center justify-end -space-x-1.5" aria-label={`Assigned to ${users.map((u) => u.full_name || u.email).join(", ")}`}>
        {shown.map((u) => (
          <Avatar key={u.id} user={u} size="sm" decorative className="ring-2 ring-surface" />
        ))}
        {users.length > max && (
          <span className="z-[1] inline-flex size-6 items-center justify-center rounded-full bg-active text-[10px] font-semibold text-fg-muted ring-2 ring-surface tabular">
            +{users.length - max}
          </span>
        )}
      </span>
    </Tooltip>
  );
}

/* ---------- Projects ---------- */

export function ProjectsPanel({ rows, className }: { rows: TeamProjectRow[]; className?: string }) {
  const sorted = useMemo(() => [...rows].sort((a, b) => b.overdue - a.overdue || b.open - a.open), [rows]);
  if (!sorted.length) return <EmptyState compact icon={FolderKanban} title="No active projects" description="Projects in scope show here with their progress." className={className} />;
  return (
    <ul className={cn("m-0 list-none p-0", className)}>
      {sorted.map((p) => {
        // Progress of what is still moving: finished this week against finished plus open.
        const pct = percent(p.done_7d, p.done_7d + p.open);
        return (
          <li key={p.project_id} className="border-b border-border-subtle last:border-b-0">
            <Link href={`/p/${p.project_id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 outline-none hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_132px]">
              <span className="flex min-w-0 items-center gap-2">
                <ClientDot color={p.color} />
                <span className="truncate text-13 font-medium text-fg">{p.name}</span>
              </span>
              <span className="order-3 col-span-2 flex items-center gap-2 sm:order-none sm:col-span-1">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-active" aria-hidden>
                  <span className="block h-full rounded-full bg-chart-2" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-9 text-right text-12 text-fg-muted tabular">{pct}%</span>
              </span>
              <span className="flex items-center justify-end gap-3 text-12 tabular text-fg-muted">
                <span>
                  <b className="font-medium text-fg">{p.open}</b> open
                </span>
                <span className={p.overdue ? "font-medium text-danger-text" : "text-fg-faint"}>{p.overdue} late</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Recent activity ---------- */

export function ActivityPanel({ items, className, max = 8 }: { items: TeamActivityItem[]; className?: string; max?: number }) {
  const link = useTaskLink();
  const now = useNow();
  if (!items.length) return <EmptyState compact icon={History} title="No recent activity" description="Changes to tasks in scope show here." className={className} />;
  return (
    <ul className={cn("m-0 list-none p-0", className)}>
      {items.slice(0, max).map((a) => {
        const who = a.actor?.full_name || a.actor?.email || "Someone";
        return (
          <li key={a.id} className="flex items-start gap-2.5 border-b border-border-subtle px-4 py-2.5 last:border-b-0">
            {a.actor ? <Avatar user={a.actor} size="sm" decorative className="mt-0.5" /> : <span className="size-6 shrink-0" />}
            <p className="min-w-0 flex-1 text-13 leading-5 text-fg-muted">
              <span className="font-medium text-fg">{who}</span> {activityVerb(a.kind)}{" "}
              <Link href={link.href(a.task_id)} scroll={false} className="font-medium text-fg hover:underline">
                {a.task_title}
              </Link>
              <span className="text-fg-faint"> in {a.project_name}</span>
            </p>
            <time dateTime={a.created_at} className="shrink-0 pt-0.5 text-12 text-fg-faint tabular">
              {now ? ago(a.created_at, now) : ""}
            </time>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Error ---------- */

export function InlineIssue({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-2 px-4 py-6 text-13 text-fg-muted">
      <CircleAlert className="size-4 text-danger-text" aria-hidden /> {message}
    </p>
  );
}

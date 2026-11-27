"use client";

import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { AtSign, CalendarClock, CalendarDays, CircleAlert, FolderKanban, History, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { useShell } from "@/components/shell/shell-context";
import { errorMessage } from "@/lib/api/client";
import { useMembers } from "@/lib/api/hooks";
import type { ActivityFeedItem, Dashboard, MentionItem, MyTask, ProjectStat, UserSummary, WorkloadRow } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { Skeleton } from "@/ui/skeleton";
import { Tooltip } from "@/ui/tooltip";
import { PrivateTaskButton } from "@/features/personal/private-task-dialog";
import { FilesCard } from "@/features/files/files-card";
import { useDashboard } from "../api";
import { FeedItem, MentionRow, MyTaskRow } from "../components/my-task-row";
import { TaskSlideOver } from "../components/task-slide-over";
import { intent, usePrefetchers } from "@/lib/api/prefetch";
import { useTaskLink } from "../lib/use-task-filters";

/*
 * Home, in the editorial-greeting style: the greeting is the h1 and states today's one fact,
 * set in the brand's navy band with a green marker; then a 12-column grid whose rows share
 * column lines (3/3/3/3, 9/3, 6/6). Figures are in the display face on tonal panels. Each chart
 * carries one brand hue on its main data element (navy for open work, green for completion)
 * and the danger step for overdue.
 */

const noop = () => () => {};

function useToday() {
  // Read in the browser only: prerender never bakes in a date or a greeting.
  return useSyncExternalStore(noop, () => format(new Date(), "yyyy-MM-dd HH"), () => "");
}

export function HomeDashboard() {
  const { me, workspaceId, current } = useWorkspace();
  const q = useDashboard(workspaceId);
  const members = useMembers(workspaceId);
  const people = useMemo(() => (members.data ?? []).map((m) => m.user), [members.data]);
  const { setCreateTaskOpen } = useShell();
  const stamp = useToday();
  const hour = stamp ? Number(stamp.slice(11, 13)) : 12;
  const salutation = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = me?.user.full_name?.split(" ")[0];
  const date = stamp ? format(new Date(`${stamp.slice(0, 10)}T12:00:00`), "EEEE, MMMM d") : "";

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-4 sm:px-6 md:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 rounded-md bg-band px-5 py-6 text-band-fg sm:px-7 md:py-8">
        <div className="min-w-0 max-w-[720px]">
          <h1 className="text-balance text-24 font-semibold leading-8 tracking-[-0.02em] text-band-fg md:text-[30px] md:leading-[38px]">
            {firstName ? `${salutation}, ${firstName}.` : `${salutation}.`}{" "}
            <span className="font-normal text-band-muted">{q.data ? headline(q.data) : ""}</span>
          </h1>
          <p className="mt-3 flex items-center gap-2 text-13 text-band-dim">
            <span aria-hidden className="size-2 shrink-0 bg-green" />
            <span className="truncate">
              {date}
              {current ? `, ${current.workspace.name}` : ""}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrivateTaskButton
            variant="ghost"
            className="border border-band-dim/40 text-band-fg hover:bg-white/10 hover:text-band-fg"
          />
          <Button
            variant="primary"
            onClick={() => setCreateTaskOpen(true)}
            className="border-band-fg bg-band-fg text-navy-deep not-disabled:active:border-band-strong not-disabled:active:bg-band-strong"
          >
            <Plus aria-hidden /> New task
          </Button>
        </div>
      </header>

      <div className="mt-6 md:mt-8">
        {q.isPending ? (
          <DashboardSkeleton />
        ) : (q.isError && q.data === undefined) ? (
          <EmptyState
            tone="danger"
            icon={CircleAlert}
            title="Your dashboard didn't load"
            description={errorMessage(q.error)}
            action={<Button onClick={() => void q.refetch()}>Try again</Button>}
          />
        ) : q.data.kind === "personal" ? (
          <Personal d={q.data} people={people} />
        ) : q.data.kind === "management" ? (
          <Management d={q.data} people={people} />
        ) : (
          <Org d={q.data} people={people} />
        )}
        <FilesCard className="mt-4" />
      </div>
      <TaskSlideOver />
    </div>
  );
}

/** The greeting's second sentence: the one fact from today's data. */
function headline(d: Dashboard): string {
  if (d.kind === "personal") {
    const due = d.today.length;
    const late = d.overdue.length;
    if (!due && !late) return d.upcoming.length ? `Nothing due today; ${d.upcoming.length} coming up this week.` : "Your week is clear.";
    const parts = [due ? `${due} due today` : null, late ? `${late} overdue` : null].filter(Boolean);
    return `${parts.join(", ")}.`;
  }
  if (d.kind === "management") {
    const late = d.workload.reduce((n, w) => n + w.overdue, 0);
    const busiest = [...d.workload].sort((a, b) => b.open - a.open)[0];
    if (late) return `${late} tasks are overdue across the team.`;
    return busiest ? `Nothing overdue. ${busiest.user.full_name.split(" ")[0]} carries the most open work.` : "Nothing overdue.";
  }
  return d.overdue_tasks ? `${d.overdue_tasks} tasks are overdue across ${d.active_projects} projects.` : `All ${d.active_projects} projects are on schedule.`;
}

/* ---------- Grid pieces ---------- */

const GRID = "grid grid-cols-2 gap-4 lg:grid-cols-12";

function Tile({ label, value, caption, tone, className }: { label: string; value: number; caption: string; tone?: "danger"; className?: string }) {
  return (
    <div className={cn("flex min-h-[112px] flex-col justify-between rounded-md bg-surface-sunken p-4 lg:col-span-3", className)}>
      <p className="text-13 text-fg-muted">{label}</p>
      <div>
        <p className={cn("figure text-[30px] font-medium leading-9 tracking-[-0.02em]", tone === "danger" && value > 0 ? "text-danger-text" : value === 0 ? "text-fg-faint" : "text-fg")}>
          {value.toLocaleString()}
        </p>
        <p className="truncate text-12 text-fg-muted">{caption}</p>
      </div>
    </div>
  );
}

function Panel({
  title,
  count,
  href,
  linkLabel = "View all",
  legend,
  className,
  children,
}: {
  title: string;
  count?: number;
  href?: string;
  linkLabel?: string;
  legend?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("col-span-2 flex min-w-0 flex-col rounded-md bg-surface-sunken p-5", className)}>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-16 font-semibold text-fg">{title}</h2>
        {count !== undefined && <span className="rounded-full bg-active px-1.5 text-11 font-medium text-fg-muted tabular">{count}</span>}
        {legend && <div className="ml-auto">{legend}</div>}
        {href && (
          <Link
            href={href}
            className={cn(
              "text-12 font-semibold text-fg underline decoration-fg decoration-2 underline-offset-4 transition-[text-decoration-color] hover:decoration-green",
              !legend && "ml-auto",
            )}
          >
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function TaskCards({ items, empty, icon, max = 5 }: { items: MyTask[]; empty: string; icon: typeof CalendarDays; max?: number }) {
  if (!items.length) return <EmptyState compact icon={icon} title={empty} className="flex-1 py-6" />;
  return (
    <ul className="flex flex-col gap-2">
      {items.slice(0, max).map((t) => (
        <MyTaskRow key={t.task.id} item={t} card />
      ))}
      {items.length > max && <li className="px-1 text-12 text-fg-muted">and {items.length - max} more</li>}
    </ul>
  );
}

function Feed({ items, people, max = 8 }: { items: ActivityFeedItem[]; people: UserSummary[]; max?: number }) {
  if (!items.length) return <EmptyState compact icon={History} title="No activity in the last two weeks" className="flex-1 py-6" />;
  return (
    <ul className="flex flex-col divide-y divide-border-subtle">
      {items.slice(0, max).map((a) => (
        <FeedItem key={a.id} item={a} people={people} />
      ))}
    </ul>
  );
}

function Mentions({ items }: { items: MentionItem[] }) {
  if (!items.length) return <EmptyState compact icon={AtSign} title="No mentions yet" description="When someone @mentions you, it shows here." className="flex-1 py-6" />;
  return (
    <ul className="-mx-2 flex flex-col">
      {items.slice(0, 5).map((m) => (
        <MentionRow key={m.id} item={m} />
      ))}
    </ul>
  );
}

/* ---------- Personal ---------- */

function Personal({ d, people }: { d: Extract<Dashboard, { kind: "personal" }>; people: UserSummary[] }) {
  return (
    <div className={GRID}>
      <Tile label="Due today" value={d.today.length} caption={d.today.length ? "Assigned to you" : "Nothing due"} />
      <Tile label="Overdue" value={d.overdue.length} caption={d.overdue.length ? "Past their due date" : "All caught up"} tone="danger" />
      <Tile label="Next 7 days" value={d.upcoming.length} caption="From tomorrow" />
      <Tile label="Mentions" value={d.mentions.length} caption="Recent" />

      <Panel title="Due horizon" className="lg:col-span-9" legend={<HorizonLegend />}>
        <Horizon today={d.today} upcoming={d.upcoming} overdue={d.overdue} />
      </Panel>
      <Panel title="Mentions" className="lg:col-span-3">
        <Mentions items={d.mentions} />
      </Panel>

      <Panel title="Today" count={d.today.length} href="/my-tasks" className="lg:col-span-6">
        <TaskCards items={d.today} icon={CalendarDays} empty="Nothing due today" />
      </Panel>
      <Panel title="Overdue" count={d.overdue.length} href="/my-tasks?tab=overdue" className="lg:col-span-6">
        <TaskCards items={d.overdue} icon={CircleAlert} empty="Nothing overdue" />
      </Panel>

      <Panel title="Upcoming" count={d.upcoming.length} href="/my-tasks?tab=upcoming" className="lg:col-span-6">
        <TaskCards items={d.upcoming} icon={CalendarClock} empty="The next 7 days are clear" />
      </Panel>
      <Panel title="Recent activity" className="lg:col-span-6">
        <Feed items={d.activity} people={people} max={6} />
      </Panel>
    </div>
  );
}

function HorizonLegend() {
  return (
    <span className="flex items-center gap-3 text-12 text-fg-muted" aria-hidden>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px] bg-chart-1" /> Due
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px] bg-chart-3" /> Overdue
      </span>
    </span>
  );
}

/**
 * The signature element: one column per day from today through the next 7 days, plus an
 * overdue column, with one mark per task. Each mark opens its task.
 */
function Horizon({ today, upcoming, overdue }: { today: MyTask[]; upcoming: MyTask[]; overdue: MyTask[] }) {
  const stamp = useToday();
  const link = useTaskLink();
  const pf = usePrefetchers();
  const days = useMemo(() => {
    const base = stamp ? startOfDay(new Date(`${stamp.slice(0, 10)}T12:00:00`)) : null;
    if (!base) return [];
    const all = [...today, ...upcoming];
    return Array.from({ length: 8 }, (_, i) => {
      const day = addDays(base, i);
      return { day, items: all.filter((t) => t.task.due_at && isSameDay(new Date(t.task.due_at), day)) };
    });
  }, [stamp, today, upcoming]);
  const max = Math.max(4, overdue.length, ...days.map((d) => d.items.length));
  const cap = Math.min(max, 8);

  const column = (key: string, label: string, sub: string, items: MyTask[], late: boolean, isToday = false) => (
    <li key={key} className="flex min-w-0 flex-col items-center">
      <div className="flex w-full flex-col items-center justify-end gap-[3px]" style={{ height: cap * 15 + 22 }}>
        <span className={cn("mb-1 text-12 tabular", items.length ? "font-medium text-fg" : "text-fg-faint")}>{items.length}</span>
        {items.slice(0, cap).map((t, i) => (
          <Tooltip key={t.task.id} content={`${t.task.title}, ${t.project_name}`}>
            <Link
              href={link.href(t.task.id)}
              scroll={false}
              {...intent(() => pf.task(t.task.id))}
              aria-label={`${t.task.title}${late ? ", overdue" : ""}`}
              className={cn(
                "h-3 w-full max-w-11 rounded-[4px] transition-transform duration-[var(--dur-fast)] ease-out motion-safe:hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                late ? "bg-chart-3" : "bg-chart-1",
                i === cap - 1 && items.length > cap && "opacity-50",
              )}
            />
          </Tooltip>
        ))}
      </div>
      <span className={cn("mt-2 border-t pt-1.5 text-12 w-full text-center", isToday ? "border-t-2 border-green font-semibold text-fg" : "border-border text-fg-muted")}>{label}</span>
      <span className="text-11 text-fg-faint tabular">{sub}</span>
    </li>
  );

  if (!days.length) return <Skeleton className="h-40" />;
  return (
    <ol className="grid grid-cols-9 gap-1.5 sm:gap-3" aria-label="Tasks due by day">
      {column("overdue", "Late", "before", overdue, true)}
      {days.map((d, i) => column(format(d.day, "yyyy-MM-dd"), i === 0 ? "Today" : format(d.day, "EEE"), format(d.day, "d"), d.items, false, i === 0))}
    </ol>
  );
}

/* ---------- Management ---------- */

function Management({ d, people }: { d: Extract<Dashboard, { kind: "management" }>; people: UserSummary[] }) {
  const open = d.workload.reduce((n, w) => n + w.open, 0);
  const late = d.workload.reduce((n, w) => n + w.overdue, 0);
  const week = d.workload.reduce((n, w) => n + w.due_this_week, 0);
  return (
    <div className={GRID}>
      <Tile label="Open tasks" value={open} caption={`Across ${d.workload.length} people`} />
      <Tile label="Overdue" value={late} caption={late ? "Need a decision" : "Nothing late"} tone="danger" />
      <Tile label="Due in 7 days" value={week} caption="Assigned work" />
      <Tile label="People" value={d.workload.length} caption="With open work" />

      <Panel title="Workload" className="lg:col-span-6" legend={<WorkloadLegend />}>
        <Workload rows={d.workload} />
      </Panel>
      <Panel title="Overdue" count={d.overdue.length} className="lg:col-span-6">
        <TaskCards items={d.overdue} icon={CircleAlert} empty="Nothing overdue across the team" />
      </Panel>

      <Panel title="Due this week" count={d.upcoming.length} className="lg:col-span-6">
        <TaskCards items={d.upcoming} icon={CalendarClock} empty="Nothing due in the next 7 days" />
      </Panel>
      <Panel title="Recent activity" className="lg:col-span-6">
        <Feed items={d.activity} people={people} max={6} />
      </Panel>
    </div>
  );
}

function WorkloadLegend() {
  return (
    <span className="flex items-center gap-3 text-12 text-fg-muted" aria-hidden>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px] bg-chart-1" /> On time
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px] bg-chart-3" /> Overdue
      </span>
    </span>
  );
}

/** Meter list: one row per person, open work split into on-time and overdue, one shared scale. */
function Workload({ rows }: { rows: WorkloadRow[] }) {
  if (!rows.length) return <EmptyState compact icon={Users} title="No one has open work" className="flex-1 py-6" />;
  const sorted = [...rows].sort((a, b) => b.open - a.open);
  const max = Math.max(1, ...sorted.map((r) => r.open));
  return (
    <ul className="flex flex-col gap-1">
      {sorted.slice(0, 10).map((r) => {
        const onTime = Math.max(0, r.open - r.overdue);
        const name = r.user.full_name || r.user.email;
        return (
          <li key={r.user.id}>
            <Tooltip content={`${name}: ${r.open} open, ${r.overdue} overdue, ${r.due_this_week} due this week`}>
              <div
                tabIndex={0}
                aria-label={`${name}: ${r.open} open, ${r.overdue} overdue, ${r.due_this_week} due this week`}
                className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_64px] items-center gap-3 rounded-sm px-1 py-1.5 outline-none hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar user={r.user} size="xs" decorative />
                  <span className="truncate text-13 text-fg">{name}</span>
                </span>
                <span className="flex h-2 items-center gap-[2px]" aria-hidden>
                  {onTime > 0 && (
                    <span
                      className={cn("h-full bg-chart-1", r.overdue ? "rounded-l-[4px]" : "rounded-r-[4px] rounded-l-[2px]")}
                      style={{ width: `${(onTime / max) * 100}%` }}
                    />
                  )}
                  {r.overdue > 0 && (
                    <span className="h-full rounded-r-[4px] bg-chart-3" style={{ width: `${(r.overdue / max) * 100}%` }} />
                  )}
                </span>
                <span className="text-right text-12 text-fg-muted tabular">
                  <span className="text-fg">{r.open}</span>
                  {r.overdue > 0 && <span className="text-danger-text"> / {r.overdue}</span>}
                </span>
              </div>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Org ---------- */

function Org({ d, people }: { d: Extract<Dashboard, { kind: "org" }>; people: UserSummary[] }) {
  return (
    <div className={GRID}>
      <Tile label="Active projects" value={d.active_projects} caption={`${d.members} members`} />
      <Tile label="Open tasks" value={d.open_tasks} caption="Across all projects" />
      <Tile label="Overdue" value={d.overdue_tasks} caption={d.overdue_tasks ? "Past their due date" : "Nothing late"} tone="danger" />
      <Tile label="Done this week" value={d.completed_this_week} caption="Last 7 days" />

      <Panel title="Projects" count={d.projects.length} className="lg:col-span-9">
        <ProjectTable rows={d.projects} />
      </Panel>
      <Panel title="Recent activity" className="lg:col-span-3">
        <Feed items={d.activity} people={people} max={4} />
      </Panel>
    </div>
  );
}

function ProjectTable({ rows }: { rows: ProjectStat[] }) {
  if (!rows.length) return <EmptyState compact icon={FolderKanban} title="No active projects" description="Create a space and a project from the sidebar." className="py-6" />;
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-13">
        <thead>
          <tr className="text-left text-12 text-fg-muted">
            <th className="px-1 pb-2 font-normal">Project</th>
            <th className="w-16 px-1 pb-2 text-right font-normal">Open</th>
            <th className="w-20 px-1 pb-2 text-right font-normal">Overdue</th>
            <th className="w-16 px-1 pb-2 text-right font-normal">Done</th>
            <th className="w-40 px-1 pb-2 pl-4 font-normal">Progress</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const total = p.open + p.done;
            const pct = total ? Math.round((p.done / total) * 100) : 0;
            return (
              <tr key={p.id} className="border-t border-border">
                <td className="max-w-0 px-1 py-2.5">
                  <Link href={`/p/${p.id}`} className="flex min-w-0 items-center gap-2 font-medium text-fg hover:underline">
                    <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </Link>
                </td>
                <td className="px-1 text-right tabular text-fg">{p.open}</td>
                <td className={cn("px-1 text-right tabular", p.overdue ? "font-medium text-danger-text" : "text-fg-faint")}>{p.overdue || "0"}</td>
                <td className="px-1 text-right tabular text-fg-muted">{p.done}</td>
                <td className="px-1 pl-4">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-active" aria-hidden>
                      <span className="block h-full rounded-full bg-chart-2" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-9 text-right text-12 text-fg-muted tabular">{pct}%</span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Skeleton ---------- */

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" className={GRID}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex min-h-[112px] flex-col justify-between rounded-md bg-surface-sunken p-4 lg:col-span-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-12" />
        </div>
      ))}
      <div className="col-span-2 h-56 rounded-md bg-surface-sunken p-5 lg:col-span-9">
        <Skeleton className="h-3.5 w-28" />
      </div>
      <div className="col-span-2 h-56 rounded-md bg-surface-sunken p-5 lg:col-span-3">
        <Skeleton className="h-3.5 w-20" />
      </div>
    </div>
  );
}

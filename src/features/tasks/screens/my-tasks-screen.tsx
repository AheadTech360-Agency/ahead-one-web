"use client";

import { ArrowRight, CalendarClock, CalendarDays, CircleAlert, ListChecks, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageBody, PageHeader } from "@/components/page";
import { PrivateTaskButton } from "@/features/personal/private-task-dialog";
import { useShell } from "@/components/shell/shell-context";
import { errorMessage } from "@/lib/api/client";
import type { MyTask } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { Skeleton } from "@/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { useMyTasks, type MyTasksBucket } from "../api";
import { MyTaskRow } from "../components/my-task-row";
import { TaskSlideOver } from "../components/task-slide-over";

const BUCKETS: { value: MyTasksBucket; label: string; icon: typeof CalendarDays; title: string; line: string }[] = [
  { value: "today", label: "Today", icon: CalendarDays, title: "Nothing due today", line: "Tasks assigned to you that are due today show up here." },
  { value: "upcoming", label: "Upcoming", icon: CalendarClock, title: "The next 7 days are clear", line: "Your tasks due from tomorrow through next week." },
  { value: "overdue", label: "Overdue", icon: CircleAlert, title: "Nothing overdue", line: "Open tasks past their due date are pulled up here." },
  { value: "all", label: "All open", icon: ListChecks, title: "No open tasks assigned to you", line: "When someone assigns you a task, it lands here." },
];

export function MyTasksScreen() {
  const { setCreateTaskOpen } = useShell();
  const { workspaceId } = useWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (BUCKETS.find((b) => b.value === params.get("tab"))?.value ?? "today") as MyTasksBucket;
  const queries = {
    today: useMyTasks(workspaceId, "today"),
    upcoming: useMyTasks(workspaceId, "upcoming"),
    overdue: useMyTasks(workspaceId, "overdue"),
    all: useMyTasks(workspaceId, "all"),
  };

  function setTab(v: string) {
    const next = new URLSearchParams(params.toString());
    if (v === "today") next.delete("tab");
    else next.set("tab", v);
    next.delete("task");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <PageBody>
      <PageHeader
        title="My tasks"
        description="Everything assigned to you, by when it's due."
        actions={
          <>
            <PrivateTaskButton />
            <Button variant="primary" onClick={() => setCreateTaskOpen(true)}>
              <Plus aria-hidden /> New task
            </Button>
          </>
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="mt-5">
        <TabsList>
          {BUCKETS.map((b) => {
            const n = queries[b.value].data?.length;
            return (
              <TabsTrigger key={b.value} value={b.value}>
                {b.label}
                {n !== undefined && n > 0 && (
                  <span
                    className={cn(
                      "min-w-5 rounded-full px-1.5 text-center text-11 font-medium tabular",
                      b.value === "overdue" ? "bg-danger-subtle text-danger-text" : "bg-active text-fg-muted",
                    )}
                  >
                    {n}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {BUCKETS.map((b) => {
          const q = queries[b.value];
          return (
            <TabsContent key={b.value} value={b.value} className="pt-2 outline-none">
              {q.isPending ? (
                <RowsSkeleton />
              ) : (q.isError && q.data === undefined) ? (
                <EmptyState
                  tone="danger"
                  icon={CircleAlert}
                  title="Your tasks didn't load"
                  description={errorMessage(q.error)}
                  action={<Button onClick={() => void q.refetch()}>Try again</Button>}
                />
              ) : b.value === "today" ? (
                <TodayTab today={q.data} overdue={queries.overdue.data ?? []} upcoming={queries.upcoming.data ?? []} onTab={setTab} />
              ) : q.data.length === 0 ? (
                <EmptyState icon={b.icon} title={b.title} description={b.line} />
              ) : b.value === "all" ? (
                <Grouped items={q.data} />
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {q.data.map((t) => (
                    <MyTaskRow key={t.task.id} item={t} />
                  ))}
                </ul>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
      <TaskSlideOver />
    </PageBody>
  );
}

/**
 * Today leads with the one fact that needs action (overdue work), then today's list, then a
 * short look at what's next so a light day still shows the week ahead.
 */
function TodayTab({
  today,
  overdue,
  upcoming,
  onTab,
}: {
  today: MyTask[];
  overdue: MyTask[];
  upcoming: MyTask[];
  onTab: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {overdue.length > 0 && (
        <button
          type="button"
          onClick={() => onTab("overdue")}
          className="group/o flex items-center gap-3 rounded-md bg-danger-subtle px-3 py-2.5 text-left text-13 text-danger-text transition-colors hover:bg-[color-mix(in_oklab,var(--danger)_18%,var(--surface))] focus-visible:outline-2 focus-visible:outline-ring"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">
            <span className="font-semibold">
              {overdue.length} overdue {overdue.length === 1 ? "task" : "tasks"}
            </span>{" "}
            past their due date and still open.
          </span>
          <span className="inline-flex items-center gap-1 font-medium">
            Review <ArrowRight className="size-3.5 transition-transform group-hover/o:translate-x-0.5" aria-hidden />
          </span>
        </button>
      )}
      {today.length === 0 ? (
        <EmptyState compact icon={CalendarDays} title="Nothing due today" description="Tasks assigned to you that are due today show up here." />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {today.map((t) => (
            <MyTaskRow key={t.task.id} item={t} />
          ))}
        </ul>
      )}
      {upcoming.length > 0 && today.length < 6 && (
        <section aria-labelledby="next-up">
          <div className="flex items-center gap-2 px-3 pb-1">
            <h2 id="next-up" className="text-13 font-semibold text-fg">
              Next up
            </h2>
            <span className="text-12 text-fg-faint tabular">{upcoming.length}</span>
            <button type="button" onClick={() => onTab("upcoming")} className="ml-auto text-12 text-fg-muted hover:text-fg hover:underline">
              See the week
            </button>
          </div>
          <ul className="divide-y divide-border-subtle border-y border-border-subtle">
            {upcoming.slice(0, 4).map((t) => (
              <MyTaskRow key={t.task.id} item={t} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** "All open" groups by project so a long list stays scannable. */
function Grouped({ items }: { items: MyTask[] }) {
  const groups = new Map<string, MyTask[]>();
  for (const i of items) {
    if (!groups.has(i.project_name)) groups.set(i.project_name, []);
    groups.get(i.project_name)!.push(i);
  }
  return (
    <div className="flex flex-col gap-5 pt-2">
      {[...groups].map(([name, rows]) => (
        <section key={name} aria-label={name}>
          <h2 className="flex items-center gap-2 px-3 pb-1 text-13 font-semibold text-fg">
            {name}
            <span className="text-12 font-normal text-fg-faint tabular">{rows.length}</span>
          </h2>
          <ul className="divide-y divide-border-subtle border-y border-border-subtle">
            {rows.map((t) => (
              <MyTaskRow key={t.task.id} item={t} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading tasks" className="divide-y divide-border-subtle">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex min-h-12 items-center gap-3 px-3">
          <Skeleton className="size-2.5 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3" style={{ width: `${35 + ((i * 13) % 30)}%` }} />
            <Skeleton className="h-2.5 w-32" />
          </div>
          <Skeleton className="h-3 w-14" />
        </div>
      ))}
    </div>
  );
}

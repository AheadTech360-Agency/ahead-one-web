"use client";

import { CircleAlert, Layers, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useShell } from "@/components/shell/shell-context";
import { FilesSummaryStrip } from "./components/files-strip";
import { TaskSlideOver } from "@/features/tasks/components/task-slide-over";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { Skeleton } from "@/ui/skeleton";
import { useTeamDashboard } from "./api";
import { ClientCards, ClientPicker, ClientStrip, ViewSwitch } from "./components/clients";
import { KpiStrip, KpiTiles } from "./components/kpis";
import { OwnerBlock } from "./components/owner-block";
import { DeltaChip, Legend, Panel } from "./components/primitives";
import { TeamSkeleton } from "./components/skeletons";
import { ActivityPanel, ProjectsPanel, TimelinePanel, WorkloadPanel } from "./components/work-panels";
import type { ClientSummary, TeamDashboard } from "@/lib/api/types";
import { canSeeTeamDashboard, dashboardKind, formatCount, parseClientParam, resolveClient, viewHref, weekDelta } from "./lib/logic";

/* The chart is code most visits do not need above the fold: load it on demand, in a box of the same height. */
const TrendHero = dynamic(() => import("./components/trend-chart"), { ssr: false, loading: () => <Skeleton className="h-[172px] w-full" /> });
const TrendSmall = dynamic(() => import("./components/trend-chart"), { ssr: false, loading: () => <Skeleton className="h-[142px] w-full" /> });

const LAST_CLIENT = "ahead-one.team.client";

function readLast(): string | undefined {
  try {
    return window.sessionStorage.getItem(LAST_CLIENT) ?? undefined;
  } catch {
    return undefined;
  }
}
function writeLast(id: string) {
  try {
    window.sessionStorage.setItem(LAST_CLIENT, id);
  } catch {
    // Session storage blocked: the picker just starts on the first client.
  }
}

/**
 * Home for Owner (executive overview), Admin and Management (operations board). One data source,
 * one URL-driven scope (`?client=<space id>`), two arrangements of the same parts.
 */
export function TeamHome() {
  const { workspaceId, role, current } = useWorkspace();
  const kind = dashboardKind(role);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { setCreateTaskOpen } = useShell();

  const param = parseClientParam(search.get("client"));
  const q = useTeamDashboard(workspaceId, param, canSeeTeamDashboard(role));
  const d = q.data;
  const clients = d?.clients;
  const clientId = resolveClient(param, clients);

  // A client id that the API did not list (or an old link): drop back to the complete view.
  useEffect(() => {
    if (param && clients && !clientId && !q.isPlaceholderData) router.replace(viewHref(pathname, search.toString(), undefined), { scroll: false });
  }, [param, clients, clientId, q.isPlaceholderData, router, pathname, search]);

  const go = useCallback(
    (id: string | undefined) => {
      if (id) writeLast(id);
      router.replace(viewHref(pathname, search.toString(), id), { scroll: false });
    },
    [router, pathname, search],
  );

  const onMode = (m: "complete" | "client") => {
    if (m === "complete") return go(undefined);
    const list = clients ?? [];
    const last = readLast();
    const pick = list.find((c) => c.space_id === last) ?? [...list].sort((a, b) => a.name.localeCompare(b.name))[0];
    if (pick) go(pick.space_id);
  };

  const client = clients?.find((c) => c.space_id === clientId);
  const mode = clientId ? "client" : "complete";
  const exec = kind === "executive";
  const noClients = clients !== undefined && clients.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-4 sm:px-6 md:pt-8">
      <Header
        kind={kind}
        mode={mode}
        client={client}
        clients={clients ?? []}
        clientId={clientId}
        workspaceName={current?.workspace.name}
        d={d}
        onMode={onMode}
        onClient={go}
        switchDisabled={noClients}
        onNewTask={() => setCreateTaskOpen(true)}
      />

      <div className={cn("mt-5 flex flex-col gap-4 md:mt-6", q.isPlaceholderData && "opacity-60 transition-opacity")} aria-busy={q.isFetching || undefined}>
        {q.isPending ? (
          <TeamSkeleton kind={kind} />
        ) : q.isError && d === undefined ? (
          <EmptyState
            tone="danger"
            icon={CircleAlert}
            title="The dashboard didn't load"
            description={errorMessage(q.error)}
            action={<Button onClick={() => void q.refetch()}>Try again</Button>}
          />
        ) : d ? (
          <>
            {!exec || mode === "client" ? (
              <ClientStrip clients={d.clients} value={clientId} onPick={go} />
            ) : null}
            {exec ? <Executive d={d} mode={mode} onOpen={go} /> : <Operations d={d} scoped={mode === "client"} />}
          </>
        ) : null}
      </div>
      <TaskSlideOver />
    </div>
  );
}

/* ---------- Header band ---------- */

function Header({
  kind,
  mode,
  client,
  clients,
  clientId,
  workspaceName,
  d,
  onMode,
  onClient,
  switchDisabled,
  onNewTask,
}: {
  kind: "executive" | "operations" | "personal";
  mode: "complete" | "client";
  client: ClientSummary | undefined;
  clients: ClientSummary[];
  clientId: string | undefined;
  workspaceName: string | undefined;
  d: TeamDashboard | undefined;
  onMode: (m: "complete" | "client") => void;
  onClient: (id: string) => void;
  switchDisabled: boolean;
  onNewTask: () => void;
}) {
  const eyebrow = mode === "client" ? "Client" : kind === "executive" ? "Executive overview" : "Operations board";
  const title = mode === "client" ? (client?.name ?? d?.scope?.space_name ?? "Client") : kind === "executive" ? (workspaceName ?? "Workspace") : "Operations";
  const fact = d
    ? d.totals.overdue_tasks > 0
      ? `${formatCount(d.totals.overdue_tasks)} overdue across ${formatCount(d.totals.active_projects)} active ${d.totals.active_projects === 1 ? "project" : "projects"}.`
      : `Nothing overdue across ${formatCount(d.totals.active_projects)} active ${d.totals.active_projects === 1 ? "project" : "projects"}.`
    : "";
  return (
    <header className="relative overflow-hidden rounded-md bg-band px-5 py-5 text-band-fg sm:px-7 md:py-7">
      {mode === "client" && client && <span aria-hidden className="absolute inset-y-0 left-0 w-2" style={{ backgroundColor: client.color }} />}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 max-w-[720px]">
          <p className="flex items-center gap-2 text-12 font-medium uppercase tracking-[0.08em] text-band-dim">
            <span aria-hidden className="size-2.5 shrink-0 bg-green" style={mode === "client" && client ? { backgroundColor: client.color, boxShadow: "0 0 0 2px var(--band-fg)" } : undefined} />
            {eyebrow}
          </p>
          <h1 className="mt-2 text-balance text-24 font-semibold leading-8 tracking-[-0.02em] text-band-fg md:text-[30px] md:leading-[38px]">
            {title} <span className="font-normal text-band-muted">{fact}</span>
          </h1>
        </div>
        <Button
          variant="primary"
          onClick={onNewTask}
          className="border-band-fg bg-band-fg text-navy-deep not-disabled:active:border-band-strong not-disabled:active:bg-band-strong"
        >
          <Plus aria-hidden /> New task
        </Button>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-band-line pt-4">
        <ViewSwitch mode={mode} onChange={onMode} disabled={switchDisabled} />
        {mode === "client" && <ClientPicker clients={clients} value={clientId} onChange={onClient} />}
        {mode === "complete" && clients.length > 0 && (
          <p className="flex items-center gap-1.5 text-12 text-band-dim">
            <Layers className="size-3.5" aria-hidden /> {clients.length} {clients.length === 1 ? "client" : "clients"} in view
          </p>
        )}
      </div>
    </header>
  );
}

/* ---------- Arrangements ---------- */

function Operations({ d, scoped }: { d: TeamDashboard; scoped: boolean }) {
  return (
    <>
      <KpiStrip totals={d.totals} scoped={scoped} />
      <div className="grid items-start gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <Panel title="Who is assigned what" count={d.workload.length} aside={<WorkloadLegend />} id="ops-workload">
            <WorkloadPanel rows={d.workload} unassigned={d.unassigned_open} />
          </Panel>
          <Panel title="Projects" count={d.projects.length} id="ops-projects">
            <ProjectsPanel rows={d.projects} />
          </Panel>
          <Panel title="Recent activity" id="ops-activity">
            <ActivityPanel items={d.recent_activity} max={6} />
          </Panel>
        </div>
        <div className="flex flex-col gap-4 lg:col-span-5">
          <Panel title="Timeline" count={d.timeline.overdue.total + d.timeline.today.total} aside="Overdue and due soon" id="ops-timeline">
            <TimelinePanel timeline={d.timeline} clients={d.clients} />
          </Panel>
          <Panel title="Completed per day" aside="Last 14 days" id="ops-trend">
            <div className="p-4">
              <TrendSmall data={d.completed_by_day} height={120} />
            </div>
          </Panel>
        </div>
      </div>
      <FilesSummaryStrip files={d.files} />
    </>
  );
}

function WorkloadLegend() {
  return <Legend items={[{ label: "On time", className: "bg-chart-1" }, { label: "Overdue", className: "bg-chart-3" }]} />;
}

function Executive({ d, mode, onOpen }: { d: TeamDashboard; mode: "complete" | "client"; onOpen: (id: string) => void }) {
  const delta = weekDelta(d.totals.completed_7d, d.totals.completed_prev_7d);
  const total14 = d.completed_by_day.reduce((n, x) => n + x.count, 0);
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-12">
        <section aria-labelledby="exec-trend" className="rounded-md border border-border bg-surface p-5 lg:col-span-8">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <h2 id="exec-trend" className="text-13 font-semibold text-fg">
                Work completed
              </h2>
              <p className="mt-2 flex items-baseline gap-3">
                <span className="figure text-[44px] font-medium leading-[48px] tracking-[-0.03em] tabular text-fg">{formatCount(d.totals.completed_7d)}</span>
                <span className="text-13 text-fg-muted">this week</span>
                <DeltaChip delta={delta} />
              </p>
            </div>
            <p className="text-12 tabular text-fg-muted">
              {formatCount(total14)} in the last 14 days
            </p>
          </div>
          <div className="mt-5">
            <TrendHero data={d.completed_by_day} height={150} hero />
          </div>
        </section>
        <KpiTiles totals={d.totals} scoped={mode === "client"} className="lg:col-span-4" />
      </div>

      {mode === "complete" && (
        <Panel title="Clients" count={d.clients.length} aside="Open a client for its own dashboard" id="exec-clients">
          <ClientCards clients={d.clients} onOpen={onOpen} />
        </Panel>
      )}

      {mode === "complete" && d.owner && <OwnerBlock owner={d.owner} files={d.files} />}

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <Panel title="Who is assigned what" count={d.workload.length} aside={<WorkloadLegend />} id="exec-workload">
            <WorkloadPanel rows={d.workload} unassigned={d.unassigned_open} />
          </Panel>
          <Panel title="Projects" count={d.projects.length} id="exec-projects">
            <ProjectsPanel rows={d.projects} />
          </Panel>
        </div>
        <div className="flex flex-col gap-4 lg:col-span-5">
          <Panel title="Timeline" count={d.timeline.overdue.total + d.timeline.today.total} aside="Overdue and due soon" id="exec-timeline">
            <TimelinePanel timeline={d.timeline} clients={d.clients} />
          </Panel>
          <Panel title="Recent activity" id="exec-activity">
            <ActivityPanel items={d.recent_activity} max={5} />
          </Panel>
        </div>
      </div>
      <FilesSummaryStrip files={d.files} />
    </>
  );
}

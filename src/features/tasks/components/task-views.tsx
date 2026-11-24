"use client";

import { CircleAlert, ListPlus } from "lucide-react";
import { useEffect } from "react";
import { errorMessage } from "@/lib/api/client";
import { useStoredState } from "@/lib/hooks/use-stored-state";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import type { ScopeData } from "../lib/use-scope-data";
import { useScopeTasks } from "../lib/use-scope-data";
import { useTaskFilters } from "../lib/use-task-filters";
import { BoardSkeletonColumns, BoardView } from "./board-view";
import { CalendarView } from "./calendar-view";
import { ListView, ListViewSkeleton } from "./list-view";
import { FiltersBar, ViewSwitcher, type ViewKind } from "./toolbar";

/** View switcher, filters and the chosen view for a list or a whole project. */
export function TaskViews({ data, onCreate }: { data: ScopeData; onCreate?: () => void }) {
  const { scope } = data;
  const [view, setView] = useStoredState<ViewKind>(`ahead-one.view.${scope.kind}.${scope.id}`, "list");
  const filters = useTaskFilters();
  const { query: tq, tasks } = useScopeTasks(scope, filters.query, view !== "list");
  const manualOrder = filters.state.sort === "position";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      const v = ({ "1": "list", "2": "board", "3": "calendar" } as const)[e.key as "1" | "2" | "3"] ?? null;
      const code = ({ Digit1: "list", Digit2: "board", Digit3: "calendar" } as const)[e.code as "Digit1"] ?? null;
      const next = v ?? code;
      if (next) {
        e.preventDefault();
        setView(next);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setView]);

  const loading = tq.isPending || data.statusesPending;
  const empty = !loading && !tq.isError && tasks.length === 0 && filters.activeCount === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ViewSwitcher value={view} onChange={setView} />
        <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
          <FiltersBar
            {...filters}
            groups={data.groups}
            people={data.people}
            meId={data.meId}
            showSort={view !== "calendar"}
          />
        </div>
      </div>

      {tq.isError ? (
        <EmptyState
          tone="danger"
          icon={CircleAlert}
          title="Tasks didn't load"
          description={errorMessage(tq.error)}
          action={<Button onClick={() => void tq.refetch()}>Try again</Button>}
        />
      ) : loading ? (
        view === "board" ? (
          <BoardSkeletonColumns />
        ) : (
          <ListViewSkeleton />
        )
      ) : empty && view !== "calendar" ? (
        <EmptyState
          icon={ListPlus}
          title={scope.kind === "list" ? "This list has no tasks yet" : "This project has no tasks yet"}
          description={
            data.access.canEdit
              ? "Add the first one. Press C from anywhere to create a task."
              : "Tasks show up here as soon as someone adds them."
          }
          action={data.access.canEdit && onCreate ? <Button variant="primary" onClick={onCreate}>Add a task</Button> : undefined}
        />
      ) : view === "board" ? (
        <BoardView data={data} tasks={tasks} manualOrder={manualOrder} />
      ) : view === "calendar" ? (
        <CalendarView data={data} tasks={tasks} />
      ) : (
        <ListView
          data={data}
          tasks={tasks}
          manualOrder={manualOrder}
          hasMore={Boolean(tq.hasNextPage)}
          loadingMore={tq.isFetchingNextPage}
          loadMore={() => void tq.fetchNextPage()}
          filtered={filters.activeCount > 0}
          clearFilters={filters.clear}
        />
      )}
    </div>
  );
}

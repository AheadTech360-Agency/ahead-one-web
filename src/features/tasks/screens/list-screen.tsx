"use client";

import { FolderX, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { Skeleton } from "@/ui/skeleton";
import { TaskSlideOver } from "../components/task-slide-over";
import { TaskViews } from "../components/task-views";
import { useListLocation, useScopeData } from "../lib/use-scope-data";
import { ScreenFrame, ScreenHeader } from "./screen-frame";

export function ListScreen() {
  const { listId } = useParams<{ listId: string }>();
  const loc = useListLocation(listId);
  const hint = useMemo(() => (loc.list ? [{ id: loc.list.id, name: loc.list.name }] : undefined), [loc.list]);
  const scope = useMemo(() => ({ kind: "list" as const, id: listId }), [listId]);
  const data = useScopeData(scope, loc.project?.id, hint);
  const { setCreateTaskOpen } = useShell();

  if (loc.status === "missing") {
    return (
      <ScreenFrame>
        <EmptyState
          className="py-24"
          icon={FolderX}
          title="This list isn't available"
          description="It was archived or deleted, or you don't have access to its project."
          action={
            <Button asChild>
              <Link href="/my-tasks">Go to My tasks</Link>
            </Button>
          }
        />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame>
      <ScreenHeader
        color={loc.project?.color}
        eyebrowHref={loc.project ? `/p/${loc.project.id}` : undefined}
        context={loc.project?.name}
        title={loc.list?.name ?? <Skeleton className="h-6 w-40" />}
        actions={
          <>
            {data.access.canManage && loc.project && (
              <Button variant="ghost" asChild>
                <Link href={`/p/${loc.project.id}/settings#statuses`}>
                  <Settings2 aria-hidden /> <span className="hidden sm:inline">Statuses</span>
                </Link>
              </Button>
            )}
            {data.access.canEdit && (
              <Button variant="primary" onClick={() => setCreateTaskOpen(true)}>
                <Plus aria-hidden /> New task
              </Button>
            )}
          </>
        }
      />
      <TaskViews data={data} onCreate={() => setCreateTaskOpen(true)} />
      <TaskSlideOver />
    </ScreenFrame>
  );
}

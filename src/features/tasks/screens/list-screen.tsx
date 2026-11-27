"use client";

import { FolderX, Lock, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PrivateTaskDialog } from "@/features/personal/private-task-dialog";
import { PERSONAL_NAME } from "@/features/personal/logic";
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
  const [privateOpen, setPrivateOpen] = useState(false);
  const isPrivate = Boolean(loc.space?.personal);
  const onCreate = () => (isPrivate ? setPrivateOpen(true) : setCreateTaskOpen(true));

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
        eyebrowHref={loc.project && !isPrivate ? `/p/${loc.project.id}` : undefined}
        context={isPrivate ? undefined : loc.project?.name}
        title={isPrivate ? PERSONAL_NAME : (loc.list?.name ?? <Skeleton className="h-6 w-40" />)}
        actions={
          <>
            {data.access.canManage && loc.project && !isPrivate && (
              <Button variant="ghost" asChild>
                <Link href={`/p/${loc.project.id}/settings#statuses`}>
                  <Settings2 aria-hidden /> <span className="hidden sm:inline">Statuses</span>
                </Link>
              </Button>
            )}
            {data.access.canEdit && (
              <Button variant="primary" onClick={onCreate}>
                <Plus aria-hidden /> {isPrivate ? "Add private task" : "New task"}
              </Button>
            )}
          </>
        }
      />
      {isPrivate && (
        <div
          role="note"
          className="flex items-center gap-2.5 rounded-md border border-border bg-surface-sunken px-3.5 py-2.5 text-13 text-fg-muted"
        >
          <Lock className="size-4 shrink-0 text-fg" aria-hidden />
          <p>
            <span className="font-medium text-fg">Only you can see these tasks.</span> Not even the Owner can open them. Move a task to a
            shared project when you want others to see it.
          </p>
        </div>
      )}
      <TaskViews data={data} onCreate={onCreate} />
      <PrivateTaskDialog open={privateOpen} onOpenChange={setPrivateOpen} />
      <TaskSlideOver />
    </ScreenFrame>
  );
}

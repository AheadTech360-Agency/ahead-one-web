"use client";

import { Archive, CircleAlert, FolderX, Globe, Lock, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useShell } from "@/components/shell/shell-context";
import { errorMessage, isApiError } from "@/lib/api/client";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/dialog";
import { EmptyState } from "@/ui/empty-state";
import { Skeleton } from "@/ui/skeleton";
import { toast } from "@/ui/toaster";
import { useProjectLists, useSetProjectArchived } from "../api";
import { permAtLeast } from "../lib/access";
import { TaskSlideOver } from "../components/task-slide-over";
import { TaskViews } from "../components/task-views";
import { useScopeData } from "../lib/use-scope-data";
import { ScreenFrame, ScreenHeader } from "./screen-frame";

export function ProjectScreen() {
  const { projectId } = useParams<{ projectId: string }>();
  const scope = useMemo(() => ({ kind: "project" as const, id: projectId }), [projectId]);
  const data = useScopeData(scope, projectId);
  const lists = useProjectLists(projectId);
  const { setCreateTaskOpen } = useShell();
  const project = data.project;

  if (data.projectStatus === "error") {
    const gone = isApiError(data.projectError) && data.projectError.isNotFound;
    return (
      <ScreenFrame>
        <EmptyState
          className="py-24"
          tone={gone ? "neutral" : "danger"}
          icon={gone ? FolderX : CircleAlert}
          title={gone ? "This project isn't available" : "The project didn't load"}
          description={gone ? "It was deleted, or you don't have access to it." : errorMessage(data.projectError)}
          action={
            <Button asChild>
              <Link href="/">Go home</Link>
            </Button>
          }
        />
      </ScreenFrame>
    );
  }

  const activeLists = (lists.data ?? []).filter((l) => !l.archived_at);

  return (
    <ScreenFrame>
      <ScreenHeader
        color={project?.color}
        title={project?.name ?? <Skeleton className="h-6 w-48" />}
        meta={
          project && (
            <>
              <span className="inline-flex items-center gap-1">
                {project.visibility === "private" ? <Lock className="size-3.5" aria-hidden /> : <Globe className="size-3.5" aria-hidden />}
                {project.visibility === "private" ? "Private to members" : "Everyone in the workspace"}
              </span>
              {project.description && <span className="max-w-[60ch] truncate">{project.description}</span>}
            </>
          )
        }
        actions={
          <>
            {project && permAtLeast(project.my_permission, "manage") && (
              <Button variant="ghost" asChild>
                <Link href={`/p/${projectId}/settings`}>
                  <Settings2 aria-hidden /> Settings
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

      {project?.archived_at && <ArchivedBanner projectId={projectId} name={project.name} canRestore={permAtLeast(project.my_permission, "manage")} />}

      {activeLists.length > 0 && (
        <nav aria-label="Lists in this project" className="-mt-1 flex flex-wrap items-center gap-1.5">
          {activeLists.map((l) => (
            <Link
              key={l.id}
              href={`/l/${l.id}`}
              className="inline-flex h-7 items-center rounded-full border border-border px-3 text-12 font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
            >
              {l.name}
            </Link>
          ))}
          {data.access.canManage && (
            <Link
              href={`/p/${projectId}/settings#lists`}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-12 text-fg-faint hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Plus className="size-3.5" aria-hidden /> List
            </Link>
          )}
        </nav>
      )}

      {lists.isSuccess && activeLists.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="This project has no open lists"
          description={data.access.canManage ? "Create a list in settings to start adding tasks." : "A project manager needs to add a list first."}
          action={
            data.access.canManage ? (
              <Button asChild>
                <Link href={`/p/${projectId}/settings#lists`}>Add a list</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <TaskViews data={data} onCreate={() => setCreateTaskOpen(true)} />
      )}
      <TaskSlideOver />
    </ScreenFrame>
  );
}

export function ArchivedBanner({ projectId, name, canRestore }: { projectId: string; name: string; canRestore: boolean }) {
  const restore = useSetProjectArchived(projectId);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md bg-warning-subtle px-4 py-2.5 text-13 text-warning-text">
      <Archive className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">This project is archived. Everything is read-only until it&apos;s restored.</p>
      {canRestore && (
        <Button size="sm" variant="secondary" onClick={() => setConfirm(true)}>
          Restore project
        </Button>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        tone="primary"
        title={`Restore ${name}?`}
        description="It returns to the sidebar and everyone with access can edit it again."
        confirmLabel={`Restore ${name}`}
        loading={restore.isPending}
        onConfirm={() =>
          restore.mutate(false, {
            onSuccess: () => {
              setConfirm(false);
              toast.success(`${name} restored`);
            },
            onError: (e) => toast.error("Couldn't restore the project", { description: `${errorMessage(e)} Try again.` }),
          })
        }
      />
    </div>
  );
}

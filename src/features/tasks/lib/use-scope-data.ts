"use client";

import { useEffect, useMemo } from "react";
import { useTree } from "@/lib/api/hooks";
import type { ListStatus, Project, Task, UserSummary } from "@/lib/api/types";
import { useWorkspace } from "@/lib/workspace";
import { useProject, useProjectLists, useStatusesFor, useTasks, type TaskFilters, type TaskScope } from "../api";
import { useAssignable } from "../components/task-controls";
import { projectAccess, type Access } from "./access";
import { buildGroups, statusIndex, type StatusGroup } from "./groups";

export type ScopeList = { id: string; name: string };

/**
 * Where a list lives. There is no GET /v1/lists/:id, so the list's project and name come from the
 * sidebar tree (filtered by access), which every screen already has cached.
 */
export function useListLocation(listId: string | undefined) {
  const { workspaceId } = useWorkspace();
  const tree = useTree(workspaceId);
  for (const s of tree.data ?? []) {
    for (const p of s.projects) {
      const l = p.lists.find((x) => x.id === listId);
      if (l) return { list: l, project: p, space: s, status: "found" as const };
    }
  }
  return { list: undefined, project: undefined, space: undefined, status: tree.isPending ? ("pending" as const) : ("missing" as const) };
}

export type ScopeData = {
  scope: TaskScope;
  project: Project | undefined;
  projectStatus: "pending" | "error" | "success";
  projectError: unknown;
  lists: ScopeList[];
  statuses: ListStatus[];
  statusesPending: boolean;
  groups: StatusGroup[];
  statusById: Map<string, ListStatus>;
  access: Access;
  people: UserSummary[];
  meId: string | undefined;
  me: UserSummary | undefined;
};

export function useScopeData(scope: TaskScope, projectId: string | undefined, listsHint?: ScopeList[]): ScopeData {
  const { me } = useWorkspace();
  const project = useProject(projectId);
  const projectLists = useProjectLists(scope.kind === "project" ? projectId : undefined);
  const lists = useMemo<ScopeList[]>(() => {
    if (scope.kind === "list") return listsHint ?? [{ id: scope.id, name: "" }];
    return (projectLists.data ?? []).filter((l) => !l.archived_at).map((l) => ({ id: l.id, name: l.name }));
  }, [scope, listsHint, projectLists.data]);
  const statusQ = useStatusesFor(lists.map((l) => l.id));
  const statuses = statusQ.data;
  const groups = useMemo(() => buildGroups(statuses, lists), [statuses, lists]);
  const statusById = useMemo(() => statusIndex(statuses), [statuses]);
  const meId = me?.user.id;
  const access = useMemo(() => projectAccess(project.data, meId), [project.data, meId]);
  const people = useAssignable(projectId);
  const meSummary = useMemo<UserSummary | undefined>(
    () => (me ? { id: me.user.id, full_name: me.user.full_name, email: me.user.email, avatar_url: me.user.avatar_url } : undefined),
    [me],
  );
  return {
    scope,
    project: project.data,
    projectStatus: project.status,
    projectError: project.error,
    lists,
    statuses,
    statusesPending: statusQ.isPending || (scope.kind === "project" && projectLists.isPending),
    groups,
    statusById,
    access,
    people,
    meId,
    me: meSummary,
  };
}

/** All tasks in a scope. Board and calendar load every page; the list loads as you scroll. */
export function useScopeTasks(scope: TaskScope, filters: TaskFilters, loadAll: boolean) {
  const q = useTasks(scope, filters);
  const { hasNextPage, isFetchingNextPage, fetchNextPage, data } = q;
  const loaded = data?.pages.reduce((n, p) => n + p.items.length, 0) ?? 0;
  useEffect(() => {
    // Cap automatic loading at 2,000 tasks; past that the list's "Load more" takes over.
    if (loadAll && hasNextPage && !isFetchingNextPage && loaded < 2000) void fetchNextPage();
  }, [loadAll, hasNextPage, isFetchingNextPage, fetchNextPage, loaded]);
  const tasks = useMemo<Task[]>(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  return { query: q, tasks };
}

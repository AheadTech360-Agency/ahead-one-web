"use client";

/*
 * Data layer for projects, lists, statuses, tasks, comments, activity, attachments, search,
 * dashboard and My Tasks. Every type comes from the generated API types; every key from `tk`
 * (feature keys) or `qk.workspace(ws)` (workspace-scoped keys shared with the shell).
 *
 * Task mutations are optimistic across every cached task collection (`["tasks", ...]`) and the
 * task detail (`["task", id]`), roll back on error, and reconcile with the server's copy.
 */

import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api/client";
import { STALE } from "@/lib/cache/stale";
import { ALLOWED_MIME, checkFile, mimeForFile } from "@/lib/files/limits";
import { qk } from "@/lib/api/keys";
import type {
  Activity,
  Attachment,
  Comment,
  CreateStatus,
  CreateTask,
  CreateUpload,
  Dashboard,
  DownloadUrl,
  JsonValue,
  List,
  ListStatus,
  MyTask,
  Page,
  Project,
  ProjectMember,
  ProjectPermission,
  SearchResults,
  Task,
  TaskDetail,
  TaskQuery,
  UpdateProject,
  UpdateStatus,
  UpdateTask,
  UploadTicket,
  UserSummary,
} from "@/lib/api/types";
import { toast } from "@/ui/toaster";
import { appendComment, mapPages, moveTaskInPages, settleComment, type CommentPages, type TaskPages } from "./lib/optimistic";

/* ---------- Keys ---------- */

export type TaskScope = { kind: "list" | "project"; id: string };
export type TaskFilters = Pick<
  TaskQuery,
  "assignee" | "status" | "priority" | "due_from" | "due_to" | "sort" | "dir" | "include_done" | "parent"
>;

export const tk = {
  tasksAll: ["tasks"] as const,
  tasks: (scope: TaskScope, filters: TaskFilters) => ["tasks", scope.kind, scope.id, filters] as const,
  task: (id: string) => ["task", id] as const,
  comments: (id: string) => ["task-comments", id] as const,
  activity: (id: string) => ["task-activity", id] as const,
  project: (id: string) => ["project", id] as const,
  projectMembers: (id: string) => ["project", id, "members"] as const,
  lists: (projectId: string) => ["project", projectId, "lists"] as const,
  statuses: (listId: string) => ["list", listId, "statuses"] as const,
};

/** Page size for task collections. The API caps at 500 and uses an offset cursor. */
export const TASK_PAGE = 200;

/* ---------- Projects, lists, statuses ---------- */

export const projectOptions = (id: string | undefined) =>
  queryOptions({
    queryKey: tk.project(id ?? ""),
    queryFn: ({ signal }) => api<Project>(`/v1/projects/${id}`, { signal }),
    enabled: Boolean(id),
    staleTime: STALE.SEMI,
  });

export function useProject(id: string | undefined) {
  return useQuery(projectOptions(id));
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProject) => api<Project>(`/v1/projects/${id}`, { method: "PATCH", body }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: tk.project(id), exact: true });
      const prev = qc.getQueryData<Project>(tk.project(id));
      if (prev) qc.setQueryData<Project>(tk.project(id), { ...prev, ...stripUndefined(body) } as Project);
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(tk.project(id), ctx.prev),
    onSuccess: (p) => qc.setQueryData(tk.project(id), p),
    onSettled: () => qc.invalidateQueries({ queryKey: ["ws"], predicate: (q) => q.queryKey[2] === "tree" }),
  });
}

export function useSetProjectArchived(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (archive: boolean) =>
      api<Project>(`/v1/projects/${id}/${archive ? "archive" : "restore"}`, { method: "POST" }),
    onSuccess: (p) => {
      qc.setQueryData(tk.project(id), p);
      void qc.invalidateQueries({ queryKey: ["ws"], predicate: (q) => q.queryKey[2] === "tree" });
    },
  });
}

export const projectMembersOptions = (id: string | undefined) =>
  queryOptions({
    queryKey: tk.projectMembers(id ?? ""),
    queryFn: ({ signal }) => api<ProjectMember[]>(`/v1/projects/${id}/members`, { signal }),
    enabled: Boolean(id),
    staleTime: STALE.PEOPLE,
  });

export function useProjectMembers(id: string | undefined) {
  return useQuery(projectMembersOptions(id));
}

export function useSetProjectMember(projectId: string) {
  const qc = useQueryClient();
  const key = tk.projectMembers(projectId);
  return useMutation({
    mutationFn: ({ user, permission }: { user: UserSummary; permission: ProjectPermission }) =>
      api<ProjectMember>(`/v1/projects/${projectId}/members/${user.id}`, { method: "PUT", body: { permission } }),
    onMutate: async ({ user, permission }) => {
      await qc.cancelQueries({ queryKey: key, exact: true });
      const prev = qc.getQueryData<ProjectMember[]>(key);
      qc.setQueryData<ProjectMember[]>(key, (rows = []) =>
        rows.some((r) => r.user.id === user.id)
          ? rows.map((r) => (r.user.id === user.id ? { ...r, permission } : r))
          : [...rows, { user, permission }],
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key, exact: true }),
  });
}

export function useRemoveProjectMember(projectId: string) {
  const qc = useQueryClient();
  const key = tk.projectMembers(projectId);
  return useMutation({
    mutationFn: (userId: string) =>
      api<void>(`/v1/projects/${projectId}/members/${userId}`, { method: "DELETE" }),
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: key, exact: true });
      const prev = qc.getQueryData<ProjectMember[]>(key);
      qc.setQueryData<ProjectMember[]>(key, (rows = []) => rows.filter((r) => r.user.id !== userId));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key, exact: true }),
  });
}

export const projectListsOptions = (projectId: string | undefined) =>
  queryOptions({
    queryKey: tk.lists(projectId ?? ""),
    queryFn: ({ signal }) => api<List[]>(`/v1/projects/${projectId}/lists`, { signal }),
    enabled: Boolean(projectId),
    staleTime: STALE.SEMI,
  });

export function useProjectLists(projectId: string | undefined) {
  return useQuery(projectListsOptions(projectId));
}

function invalidateTree(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["ws"], predicate: (q) => q.queryKey[2] === "tree" });
}

export function useCreateList(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<List>(`/v1/projects/${projectId}/lists`, { method: "POST", body: { name } }),
    onSuccess: (list) => {
      qc.setQueryData<List[]>(tk.lists(projectId), (rows = []) => [...rows, list]);
      void invalidateTree(qc);
    },
  });
}

export function useUpdateList(projectId: string) {
  const qc = useQueryClient();
  const key = tk.lists(projectId);
  return useMutation({
    mutationFn: ({ id, name, after_id }: { id: string; name?: string; after_id?: string | null }) =>
      api<List>(`/v1/lists/${id}`, { method: "PATCH", body: { name, after_id } }),
    onMutate: async ({ id, name, after_id }) => {
      await qc.cancelQueries({ queryKey: key, exact: true });
      const prev = qc.getQueryData<List[]>(key);
      qc.setQueryData<List[]>(key, (rows = []) => {
        let next = rows.map((l) => (l.id === id && name ? { ...l, name } : l));
        if (after_id !== undefined) {
          const moving = next.find((l) => l.id === id);
          if (moving) {
            next = next.filter((l) => l.id !== id);
            const at = after_id === null ? 0 : next.findIndex((l) => l.id === after_id) + 1;
            next.splice(at, 0, moving);
          }
        }
        return next;
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key, exact: true });
      void invalidateTree(qc);
    },
  });
}

export function useSetListArchived(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archive }: { id: string; archive: boolean }) =>
      api<List>(`/v1/lists/${id}/${archive ? "archive" : "restore"}`, { method: "POST" }),
    onSuccess: (list) => {
      qc.setQueryData<List[]>(tk.lists(projectId), (rows = []) => rows.map((l) => (l.id === list.id ? list : l)));
      void invalidateTree(qc);
      void qc.invalidateQueries({ queryKey: tk.tasksAll });
    },
  });
}

export const statusesOptions = (listId: string | undefined) =>
  queryOptions({
    queryKey: tk.statuses(listId ?? ""),
    queryFn: ({ signal }) => api<ListStatus[]>(`/v1/lists/${listId}/statuses`, { signal }),
    enabled: Boolean(listId),
    staleTime: STALE.STABLE,
    refetchOnWindowFocus: false,
  });

export function useStatuses(listId: string | undefined) {
  return useQuery(statusesOptions(listId));
}

/** Statuses for several lists at once (project-level views). */
export function useStatusesFor(listIds: string[]) {
  return useQueries({
    queries: listIds.map((id) => statusesOptions(id)),
    combine: (results) => ({
      data: results.flatMap((r) => r.data ?? []),
      isPending: results.some((r) => r.isPending),
      isError: results.some((r) => r.isError && r.data === undefined),
      error: results.find((r) => r.error)?.error,
      refetch: () => results.forEach((r) => void r.refetch()),
    }),
  });
}

export function useCreateStatus(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateStatus) => api<ListStatus>(`/v1/lists/${listId}/statuses`, { method: "POST", body }),
    onSuccess: (s) => qc.setQueryData<ListStatus[]>(tk.statuses(listId), (rows = []) => [...rows, s]),
  });
}

export function useUpdateStatus(listId: string) {
  const qc = useQueryClient();
  const key = tk.statuses(listId);
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateStatus & { id: string }) =>
      api<ListStatus>(`/v1/statuses/${id}`, { method: "PATCH", body }),
    onMutate: async ({ id, ...body }) => {
      await qc.cancelQueries({ queryKey: key, exact: true });
      const prev = qc.getQueryData<ListStatus[]>(key);
      qc.setQueryData<ListStatus[]>(key, (rows = []) =>
        rows.map((s) => (s.id === id ? ({ ...s, ...stripUndefined(body) } as ListStatus) : s)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key, exact: true });
      void qc.invalidateQueries({ queryKey: tk.tasksAll });
    },
  });
}

export function useReorderStatuses(listId: string) {
  const qc = useQueryClient();
  const key = tk.statuses(listId);
  return useMutation({
    mutationFn: (ids: string[]) =>
      api<ListStatus[]>(`/v1/lists/${listId}/statuses/order`, { method: "PUT", body: { ids } }),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: key, exact: true });
      const prev = qc.getQueryData<ListStatus[]>(key);
      if (prev) {
        qc.setQueryData<ListStatus[]>(
          key,
          ids.map((id) => prev.find((s) => s.id === id)).filter((s): s is ListStatus => Boolean(s)),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSuccess: (rows) => qc.setQueryData(key, rows),
  });
}

export function useDeleteStatus(listId: string) {
  const qc = useQueryClient();
  const key = tk.statuses(listId);
  return useMutation({
    mutationFn: ({ id, moveTo }: { id: string; moveTo: string }) =>
      api<void>(`/v1/statuses/${id}`, { method: "DELETE", query: { move_to: moveTo } }),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: key, exact: true });
      const prev = qc.getQueryData<ListStatus[]>(key);
      qc.setQueryData<ListStatus[]>(key, (rows = []) => rows.filter((s) => s.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key, exact: true });
      void qc.invalidateQueries({ queryKey: tk.tasksAll });
    },
  });
}

/* ---------- Task collections ---------- */

function scopePath(scope: TaskScope) {
  return scope.kind === "list" ? `/v1/lists/${scope.id}/tasks` : `/v1/projects/${scope.id}/tasks`;
}

export const tasksOptions = (scope: TaskScope | undefined, filters: TaskFilters, enabled = true) =>
  infiniteQueryOptions({
    queryKey: tk.tasks(scope ?? { kind: "list", id: "" }, filters),
    queryFn: ({ signal, pageParam }) =>
      api<Page<Task>>(scopePath(scope!), {
        signal,
        query: { ...filters, cursor: pageParam, limit: TASK_PAGE },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: Boolean(scope?.id) && enabled,
    staleTime: STALE.LIVE,
    // A filter change keeps the rows on screen until the new ones land, but only within the same
    // list or project: another scope must never show this one's tasks.
    placeholderData: (prev, prevQuery) => {
      const k = prevQuery?.queryKey;
      return k && k[1] === (scope?.kind ?? "list") && k[2] === (scope?.id ?? "") ? prev : undefined;
    },
  });

export function useTasks(scope: TaskScope | undefined, filters: TaskFilters, enabled = true) {
  return useInfiniteQuery(tasksOptions(scope, filters, enabled));
}


/** Apply `fn` to every cached task collection page. */
function mapTaskCaches(qc: QueryClient, fn: (items: Task[]) => Task[]) {
  qc.setQueriesData<TaskPages>({ queryKey: tk.tasksAll }, (data) => mapPages(data, fn));
}

function snapshot(qc: QueryClient) {
  return {
    lists: qc.getQueriesData<TaskPages>({ queryKey: tk.tasksAll }),
    detailsWithSub: qc.getQueriesData<TaskDetail>({ queryKey: ["task"] }),
  };
}
type Snapshot = ReturnType<typeof snapshot>;

function restore(qc: QueryClient, snap: Snapshot | undefined) {
  if (!snap) return;
  snap.lists.forEach(([k, v]) => qc.setQueryData(k, v));
  snap.detailsWithSub.forEach(([k, v]) => qc.setQueryData(k, v));
}

/** Patch a task everywhere it is cached: collections, its own detail, and parents' subtask lists. */
function patchTaskEverywhere(qc: QueryClient, id: string, patch: (t: Task) => Task) {
  mapTaskCaches(qc, (items) => items.map((t) => (t.id === id ? patch(t) : t)));
  qc.setQueriesData<TaskDetail>({ queryKey: ["task"] }, (d) => {
    if (!d?.task) return d;
    const own = d.task.id === id ? { ...d, task: patch(d.task) } : d;
    return own.subtasks.some((s) => s.id === id)
      ? { ...own, subtasks: own.subtasks.map((s) => (s.id === id ? patch(s) : s)) }
      : own;
  });
}

/** Move a task inside cached collections next to its new neighbours (board reorder). */
function moveInCaches(qc: QueryClient, id: string, afterId: string | null | undefined, beforeId: string | null | undefined) {
  qc.setQueriesData<TaskPages>({ queryKey: tk.tasksAll }, (data) => moveTaskInPages(data, id, afterId, beforeId));
}

export type TaskUpdateVars = {
  task: Task;
  patch: UpdateTask;
  /** Fields to show immediately (e.g. the resolved status, the due date). */
  optimistic?: Partial<Task>;
  /** Toast wording, e.g. "Couldn't change the status". */
  failure?: string;
};

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ task, patch }: TaskUpdateVars) =>
      api<Task>(`/v1/tasks/${task.id}`, { method: "PATCH", body: patch }),
    onMutate: async ({ task, patch, optimistic }) => {
      await qc.cancelQueries({ queryKey: tk.tasksAll });
      await qc.cancelQueries({ queryKey: ["task"] });
      const snap = snapshot(qc);
      const fields: Partial<Task> = { ...optimistic };
      if (patch.title !== undefined) fields.title = patch.title;
      if (patch.priority !== undefined) fields.priority = patch.priority;
      if (patch.status_id !== undefined) fields.status_id = patch.status_id;
      if (patch.due_at !== undefined) fields.due_at = patch.due_at;
      if (patch.due_has_time !== undefined) fields.due_has_time = patch.due_has_time;
      patchTaskEverywhere(qc, task.id, (t) => ({ ...t, ...fields }));
      if (patch.after_id !== undefined || patch.before_id !== undefined) {
        moveInCaches(qc, task.id, patch.after_id, patch.before_id);
      }
      if (patch.description !== undefined) {
        qc.setQueryData<TaskDetail>(tk.task(task.id), (d) => (d ? { ...d, description: patch.description ?? null } : d));
      }
      return { snap };
    },
    onError: (e, { failure }, ctx) => {
      restore(qc, ctx?.snap);
      toast.error(failure ?? "Couldn't save that change", {
        description: `${errorMessage(e)} Your previous value is back.`,
      });
    },
    onSuccess: (server) => {
      patchTaskEverywhere(qc, server.id, (t) => ({ ...t, ...server }));
    },
    onSettled: (_d, _e, { patch, task }) => {
      const structural =
        patch.status_id !== undefined ||
        patch.after_id !== undefined ||
        patch.before_id !== undefined ||
        patch.list_id !== undefined ||
        patch.due_at !== undefined;
      if (structural) {
        void qc.invalidateQueries({ queryKey: tk.tasksAll });
        void qc.invalidateQueries({ queryKey: ["ws"], predicate: (q) => q.queryKey[2] === "my-tasks" || q.queryKey[2] === "dashboard" });
      }
      void qc.invalidateQueries({ queryKey: tk.activity(task.id) });
      if (task.parent_task_id) void qc.invalidateQueries({ queryKey: tk.task(task.parent_task_id), exact: true });
    },
  });
}

export function useSetAssignees() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ task, users }: { task: Task; users: UserSummary[] }) =>
      api<Task>(`/v1/tasks/${task.id}/assignees`, { method: "PUT", body: { user_ids: users.map((u) => u.id) } }),
    onMutate: async ({ task, users }) => {
      await qc.cancelQueries({ queryKey: tk.tasksAll });
      const snap = snapshot(qc);
      patchTaskEverywhere(qc, task.id, (t) => ({ ...t, assignees: users }));
      return { snap };
    },
    onError: (e, _v, ctx) => {
      restore(qc, ctx?.snap);
      toast.error("Couldn't change assignees", { description: `${errorMessage(e)} The previous assignees are back.` });
    },
    onSuccess: (server) => patchTaskEverywhere(qc, server.id, (t) => ({ ...t, ...server })),
    onSettled: (_d, _e, { task }) => {
      void qc.invalidateQueries({ queryKey: tk.activity(task.id) });
      void qc.invalidateQueries({ queryKey: ["ws"], predicate: (q) => q.queryKey[2] === "my-tasks" });
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, body }: { listId: string; body: CreateTask }) =>
      api<Task>(`/v1/lists/${listId}/tasks`, { method: "POST", body }),
    onSuccess: (task) => {
      if (task.parent_task_id) {
        qc.setQueryData<TaskDetail>(tk.task(task.parent_task_id), (d) =>
          d ? { ...d, subtasks: [...d.subtasks, task], task: { ...d.task, subtask_count: d.task.subtask_count + 1 } } : d,
        );
        patchTaskEverywhere(qc, task.parent_task_id, (t) => ({ ...t, subtask_count: t.subtask_count + 1 }));
      }
      // Show it at once in the collections it belongs to, then let the server order them.
      for (const [key, data] of qc.getQueriesData<TaskPages>({ queryKey: tk.tasksAll })) {
        const [, kind, id, filters] = key as [string, string, string, TaskFilters];
        const parentMatches = (filters?.parent ?? null) === (task.parent_task_id ?? null);
        const scopeMatches = (kind === "list" && id === task.list_id) || (kind === "project" && id === task.project_id);
        if (!data?.pages?.length || !parentMatches || !scopeMatches) continue;
        if (data.pages.some((p) => p.items.some((t) => t.id === task.id))) continue;
        const pages = data.pages.map((p, i) => (i === data.pages.length - 1 ? { ...p, items: [...p.items, task] } : p));
        qc.setQueryData(key, { ...data, pages });
      }
      void qc.invalidateQueries({ queryKey: tk.tasksAll });
      void qc.invalidateQueries({ queryKey: ["ws"], predicate: (q) => q.queryKey[2] === "my-tasks" || q.queryKey[2] === "dashboard" });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (task: Task) => api<void>(`/v1/tasks/${task.id}`, { method: "DELETE" }),
    onMutate: async (task) => {
      await qc.cancelQueries({ queryKey: tk.tasksAll });
      const snap = snapshot(qc);
      mapTaskCaches(qc, (items) => items.filter((t) => t.id !== task.id));
      if (task.parent_task_id) {
        qc.setQueryData<TaskDetail>(tk.task(task.parent_task_id), (d) =>
          d ? { ...d, subtasks: d.subtasks.filter((s) => s.id !== task.id) } : d,
        );
      }
      return { snap };
    },
    onError: (e, _t, ctx) => {
      restore(qc, ctx?.snap);
      toast.error("Couldn't delete the task", { description: `${errorMessage(e)} It's back in place.` });
    },
    onSettled: (_d, _e, task) => {
      qc.removeQueries({ queryKey: tk.task(task.id), exact: true });
      void qc.invalidateQueries({ queryKey: tk.tasksAll });
      if (task.parent_task_id) void qc.invalidateQueries({ queryKey: tk.task(task.parent_task_id), exact: true });
      void qc.invalidateQueries({ queryKey: ["ws"], predicate: (q) => q.queryKey[2] === "my-tasks" || q.queryKey[2] === "dashboard" });
    },
  });
}

/* ---------- Task detail ---------- */

export const taskOptions = (id: string | undefined) =>
  queryOptions({
    queryKey: tk.task(id ?? ""),
    queryFn: ({ signal }) => api<TaskDetail>(`/v1/tasks/${id}`, { signal }),
    enabled: Boolean(id),
    staleTime: STALE.LIVE,
  });

export function useTask(id: string | undefined) {
  return useQuery(taskOptions(id));
}

/** Debounced description save. The editor keeps its own state; this only persists it. */
export function useSaveDescription(task: Task | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (description: JsonValue | null) =>
      api<Task>(`/v1/tasks/${task!.id}`, { method: "PATCH", body: { description } satisfies UpdateTask }),
    onSuccess: (server, description) => {
      qc.setQueryData<TaskDetail>(tk.task(server.id), (d) => (d ? { ...d, description, task: { ...d.task, ...server } } : d));
      void qc.invalidateQueries({ queryKey: tk.activity(server.id) });
    },
  });
}

/* ---------- Comments and activity ---------- */

export const commentsOptions = (taskId: string | undefined) =>
  infiniteQueryOptions({
    queryKey: tk.comments(taskId ?? ""),
    queryFn: ({ signal, pageParam }) =>
      api<Page<Comment>>(`/v1/tasks/${taskId}/comments`, { signal, query: { cursor: pageParam, limit: 100 } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: Boolean(taskId),
    staleTime: STALE.LIVE,
  });

export function useComments(taskId: string | undefined) {
  return useInfiniteQuery(commentsOptions(taskId));
}

export function useCreateComment(taskId: string, me: UserSummary | undefined) {
  const qc = useQueryClient();
  const key = tk.comments(taskId);
  return useMutation({
    mutationFn: (body: JsonValue) => api<Comment>(`/v1/tasks/${taskId}/comments`, { method: "POST", body: { body } }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CommentPages>(key);
      const temp: Comment = {
        id: `pending-${Date.now()}`,
        task_id: taskId,
        author: me ?? null,
        body,
        created_at: new Date().toISOString(),
        edited_at: null,
      };
      qc.setQueryData<CommentPages>(key, (d) => appendComment(d, temp));
      return { prev, tempId: temp.id };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(key, ctx?.prev);
      toast.error("Couldn't post your comment", { description: `${errorMessage(e)} Your text is still in the box.` });
    },
    onSuccess: (c, _v, ctx) => {
      qc.setQueryData<CommentPages>(key, (d) => settleComment(d, ctx?.tempId, c));
      patchTaskEverywhere(qc, taskId, (t) => ({ ...t, comment_count: t.comment_count + 1 }));
      void qc.invalidateQueries({ queryKey: tk.activity(taskId) });
    },
  });
}

export function useEditComment(taskId: string) {
  const qc = useQueryClient();
  const key = tk.comments(taskId);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: JsonValue }) =>
      api<Comment>(`/v1/comments/${id}`, { method: "PATCH", body: { body } }),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CommentPages>(key);
      qc.setQueryData<CommentPages>(key, (d) =>
        d
          ? {
              ...d,
              pages: d.pages.map((p) => ({
                ...p,
                items: p.items.map((c) => (c.id === id ? { ...c, body, edited_at: new Date().toISOString() } : c)),
              })),
            }
          : d,
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(key, ctx?.prev);
      toast.error("Couldn't save your edit", { description: `${errorMessage(e)} The comment shows its last saved text.` });
    },
  });
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient();
  const key = tk.comments(taskId);
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/comments/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CommentPages>(key);
      qc.setQueryData<CommentPages>(key, (d) =>
        d ? { ...d, pages: d.pages.map((p) => ({ ...p, items: p.items.filter((c) => c.id !== id) })) } : d,
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(key, ctx?.prev);
      toast.error("Couldn't delete the comment", { description: `${errorMessage(e)} It's back in the thread.` });
    },
    onSuccess: () => {
      patchTaskEverywhere(qc, taskId, (t) => ({ ...t, comment_count: Math.max(0, t.comment_count - 1) }));
      void qc.invalidateQueries({ queryKey: tk.activity(taskId) });
    },
  });
}

export function useActivity(taskId: string | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: tk.activity(taskId ?? ""),
    queryFn: ({ signal, pageParam }) =>
      api<Page<Activity>>(`/v1/tasks/${taskId}/activity`, { signal, query: { cursor: pageParam, limit: 50 } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: Boolean(taskId) && enabled,
    staleTime: 30_000,
  });
}

/* ---------- Attachments ---------- */

/** Upload rules are shared with chat and the recorder: see lib/files/limits.ts (mirrors the API). */
export function attachmentMime(file: File): string | null {
  const m = mimeForFile(file);
  return ALLOWED_MIME.includes(m) ? m : null;
}

/** Client-side check that matches the server. Returns a friendly error or null. */
export function checkAttachment(file: File): string | null {
  return checkFile(file);
}

export function useUploadAttachment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const mime = attachmentMime(file)!;
      const body: CreateUpload = { filename: file.name, mime, size_bytes: file.size };
      const ticket = await api<UploadTicket>(`/v1/tasks/${taskId}/attachments/upload-url`, { method: "POST", body });
      let put: Response;
      try {
        put = await fetch(ticket.upload_url, { method: "PUT", headers: { "content-type": mime }, body: file });
      } catch {
        throw new Error("The upload was interrupted. Check your connection and try again.");
      }
      if (!put.ok) throw new Error("Storage rejected the file. Try again in a moment.");
      return api<Attachment>(`/v1/attachments/${ticket.attachment_id}/confirm`, { method: "POST" });
    },
    onSuccess: (att) => {
      qc.setQueryData<TaskDetail>(tk.task(taskId), (d) => (d ? { ...d, attachments: [...d.attachments, att] } : d));
      patchTaskEverywhere(qc, taskId, (t) => ({ ...t, attachment_count: t.attachment_count + 1 }));
      void qc.invalidateQueries({ queryKey: tk.activity(taskId) });
    },
  });
}

export async function downloadAttachment(id: string) {
  const { url } = await api<DownloadUrl>(`/v1/attachments/${id}/download-url`);
  window.location.href = url;
}

export function useDeleteAttachment(taskId: string) {
  const qc = useQueryClient();
  const key = tk.task(taskId);
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/attachments/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key, exact: true });
      const prev = qc.getQueryData<TaskDetail>(key);
      qc.setQueryData<TaskDetail>(key, (d) => (d ? { ...d, attachments: d.attachments.filter((a) => a.id !== id) } : d));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(key, ctx?.prev);
      toast.error("Couldn't delete the file", { description: `${errorMessage(e)} It's still attached.` });
    },
    onSuccess: () => {
      patchTaskEverywhere(qc, taskId, (t) => ({ ...t, attachment_count: Math.max(0, t.attachment_count - 1) }));
      void qc.invalidateQueries({ queryKey: tk.activity(taskId) });
    },
  });
}

/* ---------- Workspace views ---------- */

export type MyTasksBucket = "today" | "upcoming" | "overdue" | "all";

export const myTasksOptions = (ws: string | undefined, bucket: MyTasksBucket) =>
  queryOptions({
    queryKey: qk.workspace(ws ?? "").myTasks(bucket),
    queryFn: ({ signal }) => api<MyTask[]>(`/v1/workspaces/${ws}/my-tasks`, { signal, query: { bucket } }),
    enabled: Boolean(ws),
    staleTime: STALE.LIVE,
    placeholderData: keepPreviousData,
  });

export function useMyTasks(ws: string | undefined, bucket: MyTasksBucket) {
  return useQuery(myTasksOptions(ws, bucket));
}

export const dashboardOptions = (ws: string | undefined) =>
  queryOptions({
    queryKey: qk.workspace(ws ?? "").dashboard(),
    queryFn: ({ signal }) => api<Dashboard>(`/v1/workspaces/${ws}/dashboard`, { signal }),
    enabled: Boolean(ws),
    staleTime: STALE.DASHBOARD,
  });

export function useDashboard(ws: string | undefined) {
  return useQuery(dashboardOptions(ws));
}

/** Global search. `q` must already be trimmed and debounced; 2 to 100 characters. */
export function useSearch(ws: string | undefined, q: string) {
  const enabled = Boolean(ws) && q.length >= 2 && q.length <= 100;
  const query = useQuery({
    queryKey: qk.workspace(ws ?? "").search(q),
    queryFn: ({ signal }) => api<SearchResults>(`/v1/workspaces/${ws}/search`, { query: { q }, signal }),
    enabled,
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  });
  return { ...query, enabled };
}

/* ---------- helpers ---------- */

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

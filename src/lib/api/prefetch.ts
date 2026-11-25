"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { conversationOptions, messagesOptions } from "@/features/messages/api";
import {
  commentsOptions,
  dashboardOptions,
  myTasksOptions,
  projectListsOptions,
  projectMembersOptions,
  projectOptions,
  statusesOptions,
  taskOptions,
  tasksOptions,
} from "@/features/tasks/api";
import { preloadEditor } from "@/features/tasks/rich-text/lazy-editor";
import { useWorkspace } from "@/lib/workspace";
import { conversationsOptions, membersOptions, treeOptions } from "./hooks";

/*
 * Warm the cache before the user gets there. Every function reuses the exact query options the
 * screen uses (same key, same staleTime), so a prefetch that lands is simply a cache hit later,
 * and one that is still fresh costs nothing. Failures are swallowed: a prefetch must never surface.
 */

const NO_FILTERS = {};
const recent = new Map<string, number>();
const THROTTLE_MS = 8_000;

/** Run `fn` at most once per key per few seconds, so hovering back and forth does not re-fire. */
function once(key: string, fn: () => unknown) {
  const now = Date.now();
  const last = recent.get(key);
  if (last !== undefined && now - last < THROTTLE_MS) return;
  recent.set(key, now);
  if (recent.size > 400) recent.clear();
  void Promise.resolve(fn()).catch(() => undefined);
}

export const prefetchers = (qc: QueryClient, ws: string | undefined) => ({
  task: (id: string) =>
    once(`task:${id}`, () => (preloadEditor(), Promise.all([qc.prefetchQuery(taskOptions(id)), qc.prefetchInfiniteQuery({ ...commentsOptions(id), pages: 1 })]))),
  project: (id: string) =>
    once(`project:${id}`, () =>
      Promise.all([
        qc.prefetchQuery(projectOptions(id)),
        qc.prefetchQuery(projectListsOptions(id)),
        qc.prefetchQuery(projectMembersOptions(id)),
        qc.prefetchInfiniteQuery({ ...tasksOptions({ kind: "project", id }, NO_FILTERS), pages: 1 }),
      ]),
    ),
  /** A list needs its tasks and statuses; its project (for permissions) is fetched when known. */
  list: (id: string, projectId?: string) =>
    once(`list:${id}`, () =>
      Promise.all([
        qc.prefetchInfiniteQuery({ ...tasksOptions({ kind: "list", id }, NO_FILTERS), pages: 1 }),
        qc.prefetchQuery(statusesOptions(id)),
        projectId ? qc.prefetchQuery(projectOptions(projectId)) : undefined,
        projectId ? qc.prefetchQuery(projectMembersOptions(projectId)) : undefined,
      ]),
    ),
  conversation: (id: string) =>
    once(`chat:${id}`, () =>
      Promise.all([qc.prefetchQuery(conversationOptions(id)), qc.prefetchInfiniteQuery({ ...messagesOptions(id), pages: 1 })]),
    ),
  home: () => once("home", () => Promise.all([qc.prefetchQuery(dashboardOptions(ws)), qc.prefetchQuery(membersOptions(ws))])),
  myTasks: () => once("my-tasks", () => qc.prefetchQuery(myTasksOptions(ws, "all"))),
});

export type Prefetchers = ReturnType<typeof prefetchers>;

export function usePrefetchers(): Prefetchers {
  const qc = useQueryClient();
  const { workspaceId } = useWorkspace();
  return useMemo(() => prefetchers(qc, workspaceId), [qc, workspaceId]);
}

/** Props that run `run` on hover, keyboard focus or touch start (intent), whichever comes first. */
export function intent(run: () => void) {
  return { onMouseEnter: run, onFocus: run, onTouchStart: run } as const;
}

/**
 * After the first screen is up and the browser is idle, warm the screens people open next:
 * the dashboard, My tasks, the member list, and the newest conversations. Persisted data that is
 * still fresh is not refetched, so this only costs requests on a cold or stale cache.
 */
export function warmAfterLoad(qc: QueryClient, ws: string) {
  const run = () => {
    const p = prefetchers(qc, ws);
    p.home();
    p.myTasks();
    void qc.prefetchQuery(treeOptions(ws));
    void qc
      .prefetchQuery(conversationsOptions(ws))
      .then(() => {
        const list = qc.getQueryData(conversationsOptions(ws).queryKey) ?? [];
        list.slice(0, 3).forEach((c) => p.conversation(c.id));
      })
      .catch(() => undefined);
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 3_000 });
  else setTimeout(run, 1_200);
}

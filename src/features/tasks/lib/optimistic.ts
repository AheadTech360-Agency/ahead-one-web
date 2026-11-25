import type { InfiniteData } from "@tanstack/react-query";
import type { Comment, Page, Task } from "@/lib/api/types";

/*
 * Pure cache edits behind the optimistic task mutations. They never mutate their input and return
 * the same object when nothing changed, so the rollback snapshot stays valid and React skips renders.
 */

export type TaskPages = InfiniteData<Page<Task>, string | undefined>;
export type CommentPages = InfiniteData<Page<Comment>, string | undefined>;

/** Apply `fn` to the items of every page. */
export function mapPages(data: TaskPages | undefined, fn: (items: Task[]) => Task[]): TaskPages | undefined {
  if (!data?.pages) return data;
  return { ...data, pages: data.pages.map((p) => ({ ...p, items: fn(p.items) })) };
}

/** Merge `patch` into one task wherever it appears in the pages. */
export function patchTaskInPages(data: TaskPages | undefined, id: string, patch: (t: Task) => Task) {
  return mapPages(data, (items) => items.map((t) => (t.id === id ? patch(t) : t)));
}

/**
 * Move a task next to its new neighbour (board reorder): after `afterId`, or before `beforeId`.
 * `afterId === null` means the very top. A task missing from the pages leaves them unchanged.
 */
export function moveTaskInPages(
  data: TaskPages | undefined,
  id: string,
  afterId: string | null | undefined,
  beforeId: string | null | undefined,
): TaskPages | undefined {
  if (!data?.pages) return data;
  let moving: Task | undefined;
  const pages = data.pages.map((p) => ({
    ...p,
    items: p.items.filter((t) => {
      if (t.id === id) moving = t;
      return t.id !== id;
    }),
  }));
  if (!moving) return data;
  const anchor = afterId ?? beforeId;
  for (const p of pages) {
    const i = anchor ? p.items.findIndex((t) => t.id === anchor) : -1;
    if (i >= 0) {
      p.items.splice(afterId ? i + 1 : i, 0, moving);
      return { ...data, pages };
    }
  }
  if (afterId === null && pages[0]) pages[0].items.unshift(moving);
  else pages[pages.length - 1]?.items.push(moving);
  return { ...data, pages };
}

/** Add a comment to the end of the thread (the last page), creating the first page when empty. */
export function appendComment(d: CommentPages | undefined, c: Comment): CommentPages {
  if (!d?.pages.length) return { pages: [{ items: [c], next_cursor: null }], pageParams: [undefined] };
  const pages = d.pages.map((p, i) => (i === d.pages.length - 1 ? { ...p, items: [...p.items, c] } : p));
  return { ...d, pages };
}

/** Swap the optimistic comment (temporary id) for the server's copy. */
export function settleComment(d: CommentPages | undefined, tempId: string | undefined, real: Comment) {
  if (!d) return d;
  return { ...d, pages: d.pages.map((p) => ({ ...p, items: p.items.map((x) => (x.id === tempId ? real : x)) })) };
}

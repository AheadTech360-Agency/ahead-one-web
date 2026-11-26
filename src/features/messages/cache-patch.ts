/*
 * Pure data patches behind the realtime cache updates (no React, no "@/" imports, so node:test can
 * run them). cache.ts applies these to TanStack Query data. Message pages are newest first.
 */

type Msg = { id: string; body: string; attachments: unknown[]; deleted?: boolean };
type Page<M> = { items: M[] };
type Conv<M> = { id: string; last_message: M | null; unread_count: number; last_read_message_id: string | null };
export type ReadStateRow = { user_id: string; last_read_message_id: string | null; last_read_at?: string | null };

const newer = (a: string | null | undefined, b: string | null | undefined) => Boolean(a) && (!b || (a as string) > b);

/** Replace a message by id, or insert it into page 0 keeping newest first. Same input object when nothing changes shape is not promised. */
export function upsertInPages<M extends { id: string }, P extends Page<M>>(pages: P[], m: M): P[] {
  if (pages.length === 0) return pages;
  let found = false;
  const next = pages.map((p) => ({
    ...p,
    items: p.items.map((x) => {
      if (x.id !== m.id) return x;
      found = true;
      return m;
    }),
  }));
  if (!found) {
    const first = next[0];
    next[0] = { ...first, items: [...first.items, m].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)) };
  }
  return next;
}

/** Turn one message into a deleted tombstone (body and files removed). */
export function tombstone<M extends Msg>(m: M): M {
  return { ...m, body: "", attachments: [], deleted: true };
}

export function tombstoneInPages<M extends Msg, P extends Page<M>>(pages: P[], messageId: string): P[] {
  return pages.map((p) => ({ ...p, items: p.items.map((m) => (m.id === messageId ? tombstone(m) : m)) }));
}

/** A new message in a conversation row: preview, unread badge, own read position. Older-than-preview messages leave the row alone. */
export function conversationWithMessage<M extends { id: string }, C extends Conv<M>>(c: C, m: M, mine: boolean, reading: boolean): C {
  if (c.last_message && newer(c.last_message.id, m.id)) return c;
  return {
    ...c,
    last_message: m,
    unread_count: mine || reading ? 0 : c.unread_count + 1,
    last_read_message_id: mine ? m.id : c.last_read_message_id,
  };
}

/** Our own read position moved (this tab or another): never backwards; reading up to the newest clears the badge. */
export function conversationWithRead<M extends { id: string }, C extends Conv<M>>(c: C, messageId: string): C {
  return {
    ...c,
    last_read_message_id: newer(messageId, c.last_read_message_id) ? messageId : c.last_read_message_id,
    unread_count: c.last_message && newer(c.last_message.id, messageId) ? c.unread_count : 0,
  };
}

/** Another reader's position moved: monotonic per user, adds the user when new. */
export function mergeReadState<T extends ReadStateRow>(list: T[], userId: string, messageId: string, at: string | null = null): T[] {
  const has = list.some((r) => r.user_id === userId);
  const next = list.map((r) => (r.user_id === userId && newer(messageId, r.last_read_message_id) ? { ...r, last_read_message_id: messageId, last_read_at: at ?? r.last_read_at } : r));
  return has ? next : [...next, { user_id: userId, last_read_message_id: messageId, last_read_at: at } as unknown as T];
}

/** Total unread across conversations (muted ones excluded when the API marks them). */
export function totalUnread(list: readonly { unread_count: number; muted?: boolean }[] | undefined): number {
  return (list ?? []).reduce((n, c) => (c.muted ? n : n + Math.max(0, c.unread_count)), 0);
}

/** Tab title with a count: "(3) Inbox | AheadOne"; capped at 99+. */
export function titleWithCount(base: string, count: number): string {
  const stripped = base.replace(/^\(\d+\+?\)\s*/, "");
  return count > 0 ? `(${count > 99 ? "99+" : count}) ${stripped}` : stripped;
}

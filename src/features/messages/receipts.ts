/*
 * Read receipts, as pure rules. Message ids are UUIDv7, so comparing the strings compares send
 * order: a reader whose `last_read_message_id` is at or past a message has read it.
 * No React and no "@/" imports, so `npm test` runs it under node:test.
 */

export type ReadStateLike = { user_id: string; last_read_message_id: string | null };
export type MessageLike = { id: string; deleted?: boolean; author: { id: string } | null };

/** True when `a` is newer than `b` (a missing `b` is older than anything). */
export const isNewer = (a: string | null | undefined, b: string | null | undefined) => Boolean(a) && (!b || (a as string) > b);

/** Has this reader read `messageId`? */
export function hasRead(messageId: string, rs: ReadStateLike | undefined): boolean {
  return Boolean(rs?.last_read_message_id && rs.last_read_message_id >= messageId);
}

/** DM: sent until the other person's read position reaches the message, then seen. */
export function dmReceipt(messageId: string, meId: string, states: readonly ReadStateLike[] | undefined): "sent" | "seen" {
  const other = states?.find((r) => r.user_id !== meId);
  return hasRead(messageId, other) ? "seen" : "sent";
}

/** Channel: ids of everyone except the sender who has read `messageId`. */
export function readerIds(messageId: string, senderId: string, states: readonly ReadStateLike[] | undefined): string[] {
  return (states ?? []).filter((r) => r.user_id !== senderId && hasRead(messageId, r)).map((r) => r.user_id);
}

/** The newest message (any order of input) sent by `meId` that is not deleted. */
export function latestOwn<T extends MessageLike>(messages: readonly T[], meId: string | undefined): T | undefined {
  if (!meId) return undefined;
  let best: T | undefined;
  for (const m of messages) if (m.author?.id === meId && !m.deleted && (!best || m.id > best.id)) best = m;
  return best;
}

/** "Seen by 3" / "Seen by Maya" / "Seen by Maya and Sam" style labels need names; this is the count form. */
export function seenByLabel(n: number): string {
  return n <= 0 ? "" : `Seen by ${n}`;
}

/**
 * Whether to send a mark-as-read now: only when the conversation is visible and focused, the newest
 * message is on screen, and it is newer than both what we already sent and the server's position.
 * Monotonic: never goes backwards, never repeats.
 */
export function shouldMarkRead(input: {
  newestId: string | undefined;
  lastSent: string | null;
  serverRead: string | null;
  unread: number;
  visible: boolean;
  focused: boolean;
  atBottom: boolean;
  isMember: boolean;
}): boolean {
  const { newestId, lastSent, serverRead, unread, visible, focused, atBottom, isMember } = input;
  if (!newestId || !isMember || !visible || !focused || !atBottom) return false;
  if (lastSent && !isNewer(newestId, lastSent)) return false;
  return unread > 0 || isNewer(newestId, serverRead);
}

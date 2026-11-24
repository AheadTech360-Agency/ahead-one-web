import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { chatKeys } from "@/lib/api/keys";
import type { Conversation, Message, Page, ReadState } from "@/lib/api/types";

/*
 * Cache edits shared by mutations and realtime events. Message pages are newest first
 * (GET /messages returns newest first; older pages follow), so a new message goes to the
 * front of page 0. Message ids are UUIDv7, so comparing the strings compares send order.
 */

export type MessagePages = InfiniteData<Page<Message>, string | undefined>;

/** Every cached conversation list, across workspaces: ["ws", ws, "conversations"]. */
const isConversationList = { queryKey: ["ws"], predicate: (q: { queryKey: readonly unknown[] }) => q.queryKey[2] === "conversations" };

export function newer(a: string | null | undefined, b: string | null | undefined) {
  if (!a) return false;
  if (!b) return true;
  return a > b;
}

export function upsertMessage(qc: QueryClient, m: Message) {
  qc.setQueryData<MessagePages>(chatKeys.messages(m.conversation_id), (data) => {
    if (!data || data.pages.length === 0) return data;
    let found = false;
    const pages = data.pages.map((p) => ({
      ...p,
      items: p.items.map((x) => {
        if (x.id !== m.id) return x;
        found = true;
        return m;
      }),
    }));
    if (!found) {
      const first = pages[0];
      // Keep page 0 sorted newest first even if events arrive out of order.
      const items = [...first.items, m].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
      pages[0] = { ...first, items };
    }
    return { ...data, pages };
  });
}

export function markMessageDeleted(qc: QueryClient, conversationId: string, messageId: string) {
  const tombstone = (m: Message): Message => ({ ...m, body: "", attachments: [], deleted: true });
  qc.setQueryData<MessagePages>(chatKeys.messages(conversationId), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((p) => ({ ...p, items: p.items.map((m) => (m.id === messageId ? tombstone(m) : m)) })),
        }
      : data,
  );
  updateConversation(qc, conversationId, (c) =>
    c.last_message?.id === messageId ? { ...c, last_message: tombstone(c.last_message) } : c,
  );
}

/** Apply `fn` to one conversation wherever it is cached. Returns false if no list held it. */
export function updateConversation(
  qc: QueryClient,
  id: string,
  fn: (c: Conversation) => Conversation,
  opts: { bump?: boolean } = {},
): boolean {
  let seen = false;
  qc.setQueriesData<Conversation[]>(isConversationList, (list) => {
    if (!list) return list;
    const i = list.findIndex((c) => c.id === id);
    if (i === -1) return list;
    seen = true;
    const next = fn(list[i]);
    if (opts.bump) return [next, ...list.slice(0, i), ...list.slice(i + 1)];
    const copy = list.slice();
    copy[i] = next;
    return copy;
  });
  qc.setQueryData<Conversation>(chatKeys.conversation(id), (c) => (c ? fn(c) : c));
  return seen;
}

/** Put a conversation (from create/join/open DM) at the top of its workspace list. */
export function insertConversation(qc: QueryClient, c: Conversation) {
  qc.setQueryData<Conversation[]>(["ws", c.workspace_id, "conversations"], (list) =>
    list ? [c, ...list.filter((x) => x.id !== c.id)] : list,
  );
  qc.setQueryData(chatKeys.conversation(c.id), c);
}

export function removeConversation(qc: QueryClient, id: string) {
  qc.setQueriesData<Conversation[]>(isConversationList, (list) => list?.filter((c) => c.id !== id));
  qc.removeQueries({ queryKey: ["chat", id] });
}

/** A message arrived (ours or someone else's): preview, order and unread count. */
export function applyNewMessage(qc: QueryClient, m: Message, meId: string | null, reading: boolean) {
  upsertMessage(qc, m);
  const mine = Boolean(meId && m.author?.id === meId);
  const seen = updateConversation(
    qc,
    m.conversation_id,
    (c) => {
      if (c.last_message && newer(c.last_message.id, m.id)) return c;
      return {
        ...c,
        last_message: m,
        unread_count: mine || reading ? 0 : c.unread_count + 1,
        last_read_message_id: mine ? m.id : c.last_read_message_id,
      };
    },
    { bump: true },
  );
  return seen;
}

export function markConversationRead(qc: QueryClient, id: string, messageId: string) {
  updateConversation(qc, id, (c) => ({
    ...c,
    last_read_message_id: newer(messageId, c.last_read_message_id) ? messageId : c.last_read_message_id,
    // Read up to the newest message clears the badge; reading an older one leaves it to the server.
    unread_count: c.last_message && newer(c.last_message.id, messageId) ? c.unread_count : 0,
  }));
}

export function applyReadState(qc: QueryClient, conversationId: string, userId: string, messageId: string) {
  qc.setQueryData<ReadState[]>(chatKeys.readStates(conversationId), (list) => {
    if (!list) return list;
    const has = list.some((r) => r.user_id === userId);
    const next = list.map((r) =>
      r.user_id === userId && newer(messageId, r.last_read_message_id) ? { ...r, last_read_message_id: messageId } : r,
    );
    return has ? next : [...next, { user_id: userId, last_read_message_id: messageId }];
  });
}

"use client";

import { useSyncExternalStore } from "react";
import type { Attachment, UserSummary } from "@/lib/api/types";

/*
 * Small client-only stores for state that is not server data: who is typing, messages still
 * being sent, which conversation is on screen, and which messaging dialog is open.
 */

function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: T | ((prev: T) => T)) {
      state = typeof next === "function" ? (next as (p: T) => T)(state) : next;
      listeners.forEach((l) => l());
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
  };
}

/* ---------- Typing ---------- */

export const TYPING_TTL = 5_000;
type TypingEntry = { user: UserSummary; until: number };
const typing = createStore<Record<string, Record<string, TypingEntry>>>({});

export function noteTyping(conversationId: string, user: UserSummary) {
  typing.set((s) => ({
    ...s,
    [conversationId]: { ...s[conversationId], [user.id]: { user, until: Date.now() + TYPING_TTL } },
  }));
}

export function clearTyping(conversationId: string, userId: string) {
  const cur = typing.get()[conversationId];
  if (!cur?.[userId]) return;
  typing.set((s) => {
    const next = { ...s[conversationId] };
    delete next[userId];
    return { ...s, [conversationId]: next };
  });
}

const EMPTY_TYPING: Record<string, TypingEntry> = {};
export function useTypingEntries(conversationId: string) {
  return useSyncExternalStore(
    typing.subscribe,
    () => typing.get()[conversationId] ?? EMPTY_TYPING,
    () => EMPTY_TYPING,
  );
}

/* ---------- Pending (optimistic) messages ---------- */

export type PendingMessage = {
  tempId: string;
  conversationId: string;
  body: string;
  attachments: Attachment[];
  createdAt: string;
  status: "sending" | "failed";
  error?: string;
};

const pending = createStore<PendingMessage[]>([]);

export const pendingStore = {
  add(p: PendingMessage) {
    pending.set((s) => [...s, p]);
  },
  update(tempId: string, patch: Partial<PendingMessage>) {
    pending.set((s) => s.map((p) => (p.tempId === tempId ? { ...p, ...patch } : p)));
  },
  remove(tempId: string) {
    pending.set((s) => s.filter((p) => p.tempId !== tempId));
  },
  /** A realtime echo of our own message arrived before the POST resolved: drop the twin. */
  settleEcho(conversationId: string, body: string) {
    const match = pending.get().find((p) => p.conversationId === conversationId && p.status === "sending" && p.body === body);
    if (match) pendingStore.remove(match.tempId);
  },
  get: (tempId: string) => pending.get().find((p) => p.tempId === tempId),
};

const EMPTY_PENDING: PendingMessage[] = [];
let lastPendingAll: PendingMessage[] = [];
let lastPendingById = new Map<string, PendingMessage[]>();
function pendingFor(conversationId: string) {
  const all = pending.get();
  if (all !== lastPendingAll) {
    lastPendingAll = all;
    lastPendingById = new Map();
  }
  let list = lastPendingById.get(conversationId);
  if (!list) {
    list = all.filter((p) => p.conversationId === conversationId);
    if (list.length === 0) list = EMPTY_PENDING;
    lastPendingById.set(conversationId, list);
  }
  return list;
}

export function usePendingMessages(conversationId: string) {
  return useSyncExternalStore(pending.subscribe, () => pendingFor(conversationId), () => EMPTY_PENDING);
}

/* ---------- Conversation on screen ---------- */

let activeConversation: string | null = null;
export function setActiveConversation(id: string | null) {
  activeConversation = id;
}
/** True when the user can see this conversation right now (open, tab visible and focused). */
export function isReadingConversation(id: string) {
  return (
    activeConversation === id &&
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    document.hasFocus()
  );
}

/* ---------- Dialogs ---------- */

export type MessagesDialog = "channel" | "dm" | "browse" | null;
const dialog = createStore<MessagesDialog>(null);

export const openMessagesDialog = (d: MessagesDialog) => dialog.set(d);
export function useMessagesDialog() {
  return useSyncExternalStore(dialog.subscribe, dialog.get, () => null);
}

"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { chatKeys, qk } from "@/lib/api/keys";
import type { WsClientEvent, WsServerEvent } from "@/lib/api/types";
import { env, isApiConfigured, isSupabaseConfigured } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";
import {
  applyNewMessage,
  applyReadState,
  markConversationRead,
  markMessageDeleted,
  upsertMessage,
} from "@/features/messages/cache";
import { clearTyping, isReadingConversation, noteTyping, pendingStore } from "@/features/messages/stores";
import { addNotification } from "@/features/notifications/cache";
import { RealtimeClient, socketUrl, type RealtimeStatus } from "./socket";

const Ctx = createContext<RealtimeClient | null>(null);

async function sessionToken(opts?: { refresh?: boolean }) {
  try {
    const auth = getSupabase().auth;
    if (opts?.refresh) {
      const { data } = await auth.refreshSession();
      if (data.session) return data.session.access_token;
    }
    const { data } = await auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** Keep TanStack Query caches in step with server events. */
function applyEvent(qc: QueryClient, ev: WsServerEvent, meId: string | null) {
  switch (ev.type) {
    case "message.created": {
      const m = ev.message;
      if (m.author) clearTyping(m.conversation_id, m.author.id);
      if (meId && m.author?.id === meId) pendingStore.settleEcho(m.conversation_id, m.body);
      const known = applyNewMessage(qc, m, meId, isReadingConversation(m.conversation_id));
      // A conversation we haven't loaded (a new DM, a channel we were just added to).
      if (!known) void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "ws" && q.queryKey[2] === "conversations" });
      break;
    }
    case "message.updated":
      upsertMessage(qc, ev.message);
      qc.setQueriesData({ queryKey: ["ws"], predicate: (q) => q.queryKey[2] === "conversations" }, (list: unknown) =>
        Array.isArray(list)
          ? list.map((c) => (c.last_message?.id === ev.message.id ? { ...c, last_message: ev.message } : c))
          : list,
      );
      break;
    case "message.deleted":
      markMessageDeleted(qc, ev.conversation_id, ev.message_id);
      break;
    case "typing":
      if (ev.user.id !== meId) noteTyping(ev.conversation_id, ev.user);
      break;
    case "read":
      applyReadState(qc, ev.conversation_id, ev.user_id, ev.message_id);
      if (ev.user_id === meId) markConversationRead(qc, ev.conversation_id, ev.message_id);
      break;
    case "notification.created":
      addNotification(qc, ev.notification);
      break;
    case "conversation.updated":
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "ws" && (q.queryKey[2] === "conversations" || q.queryKey[2] === "channels-browse") });
      void qc.invalidateQueries({ queryKey: chatKeys.conversation(ev.conversation_id) });
      void qc.invalidateQueries({ queryKey: chatKeys.members(ev.conversation_id) });
      break;
  }
}

/**
 * Owns the tab's WebSocket. Starts when Supabase has a session, re-auths on token refresh,
 * stops on sign-out, and refetches conversations, messages and notifications after a reconnect.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [client] = useState(() =>
    isApiConfigured && isSupabaseConfigured ? new RealtimeClient(socketUrl(env.apiUrl), sessionToken) : null,
  );

  useEffect(() => {
    if (!client) return;
    const offEvents = client.subscribe((ev) => applyEvent(qc, ev, client.userId));
    const offReconnect = client.onReconnect(() => {
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "ws" && q.queryKey[2] === "conversations" });
      void qc.invalidateQueries({ queryKey: chatKeys.all });
      void qc.invalidateQueries({ queryKey: qk.notifications.all });
    });
    client.start();

    const { data: sub } = getSupabase().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") client.stop();
      else if (event === "SIGNED_IN") client.start();
      else if (event === "TOKEN_REFRESHED" && session) void client.reauth(session.access_token);
    });

    return () => {
      sub.subscription.unsubscribe();
      offEvents();
      offReconnect();
      client.stop();
    };
  }, [client, qc]);

  return <Ctx.Provider value={client}>{children}</Ctx.Provider>;
}

const idle = () => () => {};

/** Connection state for status lines ("Reconnecting"). "idle" when realtime isn't configured. */
export function useRealtimeStatus(): RealtimeStatus {
  const client = useContext(Ctx);
  return useSyncExternalStore(
    client?.onStatus ?? idle,
    client?.getStatus ?? (() => "idle" as const),
    () => "idle" as const,
  );
}

/** Subscribe to server events. The handler can change between renders without resubscribing. */
export function useRealtimeEvent(handler: (ev: WsServerEvent) => void) {
  const client = useContext(Ctx);
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => client?.subscribe((ev) => ref.current(ev)), [client]);
}

/** Send a client frame (typing). Returns false while disconnected. */
export function useRealtimeSend() {
  const client = useContext(Ctx);
  return (ev: WsClientEvent) => client?.send(ev) ?? false;
}


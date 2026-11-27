"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { chatKeys, qk } from "@/lib/api/keys";
import type { WsClientEvent, WsServerEvent } from "@/lib/api/types";
import { getAccessToken, getSessionState, subscribeSession } from "@/lib/auth/client";
import { env, isApiConfigured } from "@/lib/env";
import {
  applyNewMessage,
  applyReadState,
  markConversationRead,
  markMessageDeleted,
  upsertMessage,
} from "@/features/messages/cache";
import { applyVoicePlayed, isVoicePlayedEvent } from "@/features/voice/cache";
import { clearTyping, isReadingConversation, noteTyping, pendingStore } from "@/features/messages/stores";
import { addNotification } from "@/features/notifications/cache";
import { RealtimeClient, socketUrl, type RealtimeStatus } from "./socket";

const Ctx = createContext<RealtimeClient | null>(null);

/** Tokens come from the auth module. After a 4401 close, force a refresh; on the server's `reauth`, make sure the token has real time left. */
function sessionToken(opts?: { refresh?: boolean; fresh?: boolean }) {
  if (opts?.refresh) return getAccessToken({ force: true });
  if (opts?.fresh) return getAccessToken({ minValiditySec: 300 });
  return getAccessToken();
}

/** Keep TanStack Query caches in step with server events. */
function applyEvent(qc: QueryClient, ev: WsServerEvent, meId: string | null) {
  // `voice.played` is not in the generated frame type yet (see features/voice/contract.ts).
  if (isVoicePlayedEvent(ev)) {
    applyVoicePlayed(qc, ev);
    return;
  }
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
 * Owns the tab's WebSocket. Starts once there is a session, sends a fresh auth frame when the
 * server asks (`reauth`), stops on sign-out, and refetches conversations, messages and notifications after a reconnect.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [client] = useState(() =>
    isApiConfigured ? new RealtimeClient(socketUrl(env.apiUrl), sessionToken) : null,
  );

  useEffect(() => {
    if (!client) return;
    const offEvents = client.subscribe((ev) => applyEvent(qc, ev, client.userId));
    const offReconnect = client.onCatchUp(() => {
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "ws" && q.queryKey[2] === "conversations" });
      void qc.invalidateQueries({ queryKey: chatKeys.all });
      void qc.invalidateQueries({ queryKey: qk.notifications.all });
    });
    client.start();

    // Sign-out (this tab or another) closes the socket; a new sign-in opens it again.
    const offSession = subscribeSession(() => {
      const { status } = getSessionState();
      if (status === "signedOut") client.stop();
      else if (status === "signedIn") client.start();
    });

    return () => {
      offSession();
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


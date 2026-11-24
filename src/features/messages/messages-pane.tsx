"use client";

import { useParams, usePathname } from "next/navigation";
import { ConversationList } from "./conversation-list";
import { ConversationView } from "./conversation-view";

/** Route glue: the list knows which conversation is open from the URL. */
export function MessagesPane() {
  const pathname = usePathname();
  const params = useParams<{ conversationId?: string }>();
  return <ConversationList activeId={params.conversationId} isIndex={pathname === "/messages"} />;
}

export function ConversationRoute() {
  const { conversationId } = useParams<{ conversationId: string }>();
  return <ConversationView key={conversationId} conversationId={conversationId} />;
}

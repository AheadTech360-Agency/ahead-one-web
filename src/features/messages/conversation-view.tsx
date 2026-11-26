"use client";

import { Bell, BellOff, ChevronLeft, CircleAlert, FolderOpen, Hash, Info, Lock, MoreHorizontal, RotateCw, Users, WifiOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage, isApiError } from "@/lib/api/client";
import { useConversations } from "@/lib/api/hooks";
import type { Conversation } from "@/lib/api/types";
import { useWorkspace } from "@/lib/workspace";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { IconButton } from "@/ui/icon-button";
import { toast } from "@/ui/toaster";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/menu";
import { useRealtimeStatus } from "@/features/realtime/provider";
import { useChannelMembers, useConversation, useJoinChannel, useMarkRead, useMessages, useMuteConversation, useReadStates, useSendMessage } from "./api";
import { shouldMarkRead } from "./receipts";
import { ConversationFiles } from "@/features/files/conversation-files";
import { ChannelDetails } from "./channel-details";
import { Composer, type ComposerHandle } from "./composer";
import { conversationLabel, conversationName, dmPartner } from "./format";
import { MessageList } from "./message-list";
import { setActiveConversation } from "./stores";
import { TypingIndicator } from "./typing-indicator";
import { usePeople } from "./use-people";

function ConnectionNote() {
  const status = useRealtimeStatus();
  if (status === "open" || status === "idle" || status === "connecting") return null;
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-warning-subtle px-2 text-11 font-medium text-warning-text" role="status">
      <WifiOff className="size-3" aria-hidden />
      {status === "offline" ? "Offline" : "Reconnecting"}
    </span>
  );
}

/** The `muted` field lands with the API's mute endpoint; until it is generated, read it defensively. */
function isMuted(c: Conversation) {
  return (c as Conversation & { muted?: boolean }).muted === true;
}

function ConversationMenu({ c }: { c: Conversation }) {
  const mute = useMuteConversation();
  const muted = isMuted(c);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={muted ? "Conversation options (muted)" : "Conversation options"}>
          {muted ? <BellOff aria-hidden /> : <MoreHorizontal aria-hidden />}
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() =>
            mute.mutate(
              { id: c.id, muted: !muted },
              { onError: (e) => toast.error(muted ? "Couldn't unmute" : "Couldn't mute", { description: errorMessage(e) }) },
            )
          }
        >
          {muted ? <Bell aria-hidden /> : <BellOff aria-hidden />}
          {muted ? "Unmute notifications" : "Mute notifications"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Header({ c, meId, onDetails, onFiles }: { c: Conversation; meId?: string; onDetails: () => void; onFiles: () => void }) {
  const partner = c.kind === "dm" ? dmPartner(c, meId) : undefined;
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border-subtle px-2 sm:px-4">
      <Link
        href="/messages"
        aria-label="Back to conversations"
        className="inline-flex size-8 items-center justify-center rounded-sm text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring md:hidden"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Link>
      {partner ? (
        <Avatar user={partner} size="sm" decorative />
      ) : c.is_private ? (
        <Lock className="size-4 shrink-0 text-fg-muted" aria-label="Private channel" />
      ) : (
        <Hash className="size-4 shrink-0 text-fg-muted" aria-hidden />
      )}
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        {c.kind === "channel" ? (
          <h1 className="min-w-0 truncate text-14 font-semibold text-fg">
            <button
              type="button"
              onClick={onDetails}
              className="max-w-full truncate rounded-xs hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {conversationName(c, meId)}
            </button>
          </h1>
        ) : (
          <h1 className="truncate text-14 font-semibold text-fg">{conversationName(c, meId)}</h1>
        )}
        <p className="hidden min-w-0 truncate text-12 text-fg-muted sm:block">
          {c.kind === "channel" ? c.topic : partner?.full_name ? partner.email : null}
        </p>
      </div>
      <ConnectionNote />
      {c.is_member && <ConversationMenu c={c} />}
      {c.is_member && (
        <IconButton label="Files in this conversation" onClick={onFiles}>
          <FolderOpen aria-hidden />
        </IconButton>
      )}
      {c.kind === "channel" && (
        <>
          <button
            type="button"
            onClick={onDetails}
            aria-label={`${c.member_count} members. Show channel details`}
            className="hidden h-7 items-center gap-1.5 rounded-sm border border-border px-2 text-12 font-medium text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring sm:inline-flex"
          >
            <Users className="size-3.5" aria-hidden />
            <span className="tabular">{c.member_count}</span>
          </button>
          <IconButton label="Channel details" onClick={onDetails}>
            <Info aria-hidden />
          </IconButton>
        </>
      )}
    </header>
  );
}

function JoinPanel({ c }: { c: Conversation }) {
  const join = useJoinChannel();
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <EmptyState
        icon={Hash}
        title={`You're not in #${c.name}`}
        description={c.topic || `Join to read the conversation and post. ${c.member_count} ${c.member_count === 1 ? "person is" : "people are"} here.`}
        action={
          <Button
            variant="primary"
            loading={join.isPending}
            onClick={() =>
              join.mutate(c.id, {
                onError: (e) => toast.error(`Couldn't join #${c.name}`, { description: errorMessage(e) }),
              })
            }
          >
            Join #{c.name}
          </Button>
        }
      />
    </div>
  );
}

function Loaded({ c }: { c: Conversation }) {
  const { me } = useWorkspace();
  const meId = me?.user.id;
  const [details, setDetails] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const composer = useRef<ComposerHandle>(null);
  const send = useSendMessage(c.id);
  const markRead = useMarkRead();
  const messages = useMessages(c.id, c.is_member);
  const readStates = useReadStates(c.id, c.is_member);
  const channelMembers = useChannelMembers(c.id, c.is_member && c.kind === "channel");
  const candidates = useMemo(
    () => (c.kind === "dm" ? c.members : (channelMembers.data ?? [])),
    [c.kind, c.members, channelMembers.data],
  );
  const authors = useMemo(
    () => (messages.data?.pages ?? []).flatMap((p) => p.items.map((m) => m.author)),
    [messages.data],
  );
  const people = usePeople([...candidates, ...authors]);

  const newest = messages.data?.pages[0]?.items[0];
  const lastMine = useMemo(
    () => (messages.data?.pages ?? []).flatMap((p) => p.items).find((m) => m.author?.id === meId && !m.deleted),
    [messages.data, meId],
  );

  useEffect(() => {
    setActiveConversation(c.id);
    return () => setActiveConversation(null);
  }, [c.id]);

  // Read receipts: mark the newest message read while it is on screen, the tab is visible and the
  // window has focus. Debounced so a burst of messages sends one request; monotonic (never backwards).
  const marked = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ c, newest, atBottom });
  useEffect(() => {
    latest.current = { c, newest, atBottom };
  });
  const check = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const { c: conv, newest: n, atBottom: bottom } = latest.current;
      const ok = shouldMarkRead({
        newestId: n?.id,
        lastSent: marked.current,
        serverRead: conv.last_read_message_id,
        unread: conv.unread_count,
        visible: document.visibilityState === "visible",
        focused: document.hasFocus(),
        atBottom: bottom,
        isMember: conv.is_member,
      });
      if (!ok || !n) return;
      marked.current = n.id;
      markRead(conv.id, n.id);
    }, 250);
  }, [markRead]);
  useEffect(() => {
    check();
  }, [check, newest?.id, atBottom, c.unread_count]);
  useEffect(() => {
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [check]);

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && c.is_member && e.preventDefault()}
      onDrop={(e) => {
        if (!c.is_member || !e.dataTransfer.files.length) return;
        e.preventDefault();
        composer.current?.addFiles([...e.dataTransfer.files]);
      }}
    >
      <Header c={c} meId={meId} onDetails={() => setDetails(true)} onFiles={() => setFilesOpen(true)} />
      {c.is_member ? (
        <>
          <MessageList
            conversation={c}
            meId={meId}
            me={me?.user}
            people={people}
            candidates={candidates}
            readStates={readStates.data}
            editingId={editingId}
            setEditingId={(id) => {
              setEditingId(id);
              if (!id) composer.current?.focus();
            }}
            onAtBottomChange={setAtBottom}
          />
          <div className="shrink-0 px-3 pb-3 sm:px-5">
            <TypingIndicator conversationId={c.id} />
            <Composer
              key={c.id}
              ref={composer}
              conversationId={c.id}
              candidates={candidates}
              meId={meId}
              autoFocus
              placeholder={`Message ${conversationLabel(c, meId)}`}
              recordLabel={conversationLabel(c, meId)}
              onEditLast={lastMine ? () => setEditingId(lastMine.id) : undefined}
              onSubmit={(body, attachments) => {
                void send.send(body, attachments).catch((e) =>
                  toast.error("Your message wasn't sent", {
                    description: `${errorMessage(e)} Use Retry on the message to send it again.`,
                  }),
                );
              }}
            />
          </div>
        </>
      ) : c.kind === "channel" && !c.is_private ? (
        <JoinPanel c={c} />
      ) : null}
      {c.is_member && <ConversationFiles c={c} open={filesOpen} onOpenChange={setFilesOpen} />}
      {c.kind === "channel" && <ChannelDetails c={c} open={details} onOpenChange={setDetails} />}
    </div>
  );
}

/** The open conversation. Takes the list's copy when it has one, else fetches it. */
export function ConversationView({ conversationId }: { conversationId: string }) {
  const { workspaceId, me } = useWorkspace();
  const router = useRouter();
  const list = useConversations(workspaceId);
  const fromList = list.data?.find((c) => c.id === conversationId);
  const detail = useConversation(fromList || list.isPending ? undefined : conversationId);
  const c = fromList ?? detail.data;

  useEffect(() => {
    if (c) document.title = `${conversationLabel(c, me?.user.id)} | AheadOne`;
  }, [c, me?.user.id]);

  if (c) return <Loaded c={c} />;

  if ((detail.isError && detail.data === undefined)) {
    const missing = isApiError(detail.error) && (detail.error.isNotFound || detail.error.status === 403);
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={CircleAlert}
          tone={missing ? "neutral" : "danger"}
          title={missing ? "This conversation isn't available" : "Couldn't open this conversation"}
          description={
            missing
              ? "It may have been archived, or you may no longer be a member."
              : errorMessage(detail.error)
          }
          action={
            missing ? (
              <Button onClick={() => router.push("/messages")}>Back to messages</Button>
            ) : (
              <Button onClick={() => detail.refetch()}>
                <RotateCw aria-hidden /> Try again
              </Button>
            )
          }
        />
      </div>
    );
  }

  return <ConversationLoading />;
}

export function ConversationLoading() {
  return (
    <div role="status" aria-label="Loading conversation" className="flex h-full flex-col">
      <div className="flex h-12 items-center gap-2 border-b border-border-subtle px-5" aria-hidden>
        <span className="size-4 rounded-xs bg-active" />
        <span className="h-3 w-32 rounded-xs bg-active" />
      </div>
      <div className="flex-1" />
      <div className="mx-5 mb-8 h-[88px] rounded-md border border-border" aria-hidden />
    </div>
  );
}


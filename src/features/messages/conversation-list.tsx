"use client";

import { Hash, Lock, MessageSquarePlus, MessagesSquare, Plus, RotateCw, Search, SquarePen, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import { useConversations } from "@/lib/api/hooks";
import type { Conversation } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { IconButton } from "@/ui/icon-button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/menu";
import { Skeleton } from "@/ui/skeleton";
import { conversationLabel, conversationName, dmPartner, listStamp, previewOf, type People } from "./format";
import { intent, usePrefetchers } from "@/lib/api/prefetch";
import { openMessagesDialog } from "./stores";
import { useTypers } from "./typing-indicator";
import { usePeople } from "./use-people";

export function NewConversationMenu({ trigger }: { trigger: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => openMessagesDialog("dm")}>
          <MessageSquarePlus aria-hidden /> New direct message
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openMessagesDialog("channel")}>
          <Plus aria-hidden /> Create a channel
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openMessagesDialog("browse")}>
          <Hash aria-hidden /> Browse channels
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TypingOr({ c, children }: { c: Conversation; children: React.ReactNode }) {
  const names = useTypers(c.id);
  if (names.length === 0) return <>{children}</>;
  return <span className="text-accent-text">{c.kind === "dm" ? "typing…" : `${names[0]} is typing…`}</span>;
}

function Row({ c, active, meId, people }: { c: Conversation; active: boolean; meId?: string; people: People }) {
  const pf = usePrefetchers();
  const partner = c.kind === "dm" ? dmPartner(c, meId) : undefined;
  const unread = c.unread_count > 0 && !active;
  const preview = previewOf(c.last_message, people, meId);
  return (
    <Link
      href={`/messages/${c.id}`}
      {...intent(() => pf.conversation(c.id))}
      aria-current={active ? "page" : undefined}
      aria-label={`${conversationLabel(c, meId)}${unread ? `, ${c.unread_count} unread` : ""}`}
      className={cn(
        "flex items-center gap-2.5 rounded-sm px-2.5 py-2",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
        active ? "bg-active" : "hover:bg-hover",
      )}
    >
      {partner ? (
        <Avatar user={partner} size="md" decorative />
      ) : (
        <span className={cn("flex size-8 shrink-0 items-center justify-center", unread ? "text-fg" : "text-fg-faint")}>
          {c.is_private ? <Lock className="size-4" strokeWidth={1.75} aria-hidden /> : <Hash className="size-4" strokeWidth={1.75} aria-hidden />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-13", unread ? "font-semibold text-fg" : "font-medium text-fg")}>
            {conversationName(c, meId)}
          </span>
          {c.last_message && (
            <span className={cn("shrink-0 text-11 tabular", unread ? "font-medium text-fg" : "text-fg-faint")}>
              {listStamp(c.last_message.created_at)}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-12", unread ? "text-fg" : "text-fg-muted")}>
            <TypingOr c={c}>{preview ?? (c.kind === "channel" ? c.topic || "No messages yet" : "Say hello")}</TypingOr>
          </span>
          {unread && (
            <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-green px-1 text-11 font-bold leading-none text-navy-deep tabular" aria-hidden>
              {c.unread_count > 99 ? "99+" : c.unread_count}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col" role="status" aria-label="Loading conversations">
      {[60, 40, 72, 52, 36, 64].map((w, i) => (
        <div key={i} className="flex items-center gap-2.5 px-2.5 py-2.5" aria-hidden>
          <Skeleton className={cn("size-8", i % 3 === 0 ? "rounded-sm" : "rounded-full")} />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5" style={{ width: `${w}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Left pane of Messages: every DM and channel you're in, most recent first.
 * Alt+Up / Alt+Down move to the previous or next conversation from anywhere in Messages.
 */
export function ConversationList({ activeId, isIndex }: { activeId?: string; isIndex: boolean }) {
  const router = useRouter();
  const { workspaceId, me } = useWorkspace();
  const meId = me?.user.id;
  const q = useConversations(workspaceId);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [search, setSearch] = useState("");
  const dmPeople = useMemo(() => (q.data ?? []).flatMap((c) => c.members), [q.data]);
  const people = usePeople(dmPeople);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (q.data ?? []).filter((c) => {
      if (filter === "unread" && c.unread_count === 0 && c.id !== activeId) return false;
      if (!term) return true;
      const partner = c.kind === "dm" ? dmPartner(c, meId) : undefined;
      return (
        conversationName(c, meId).toLowerCase().includes(term) ||
        Boolean(partner?.email.toLowerCase().includes(term))
      );
    });
  }, [q.data, filter, search, meId, activeId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.metaKey || e.ctrlKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      if (shown.length === 0) return;
      e.preventDefault();
      const i = shown.findIndex((c) => c.id === activeId);
      const next =
        i === -1 ? (e.key === "ArrowDown" ? 0 : shown.length - 1) : (i + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
      router.push(`/messages/${shown[next].id}`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, activeId, router]);

  const totalUnread = (q.data ?? []).reduce((n, c) => n + (c.unread_count > 0 ? 1 : 0), 0);

  return (
    <aside
      aria-label="Conversations"
      className={cn("min-h-0 flex-col border-border-subtle md:flex md:border-r", isIndex ? "flex" : "hidden")}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border-subtle pl-4 pr-2">
        {isIndex ? (
          <h1 className="text-14 font-semibold text-fg">Messages</h1>
        ) : (
          <h2 className="text-14 font-semibold text-fg">Messages</h2>
        )}
        <NewConversationMenu
          trigger={
            <IconButton label="New conversation">
              <SquarePen aria-hidden />
            </IconButton>
          }
        />
      </div>
      <div className="flex shrink-0 flex-col gap-2 px-2 pb-1 pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-faint" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && search && (e.preventDefault(), setSearch(""))}
            placeholder="Find a conversation"
            aria-label="Find a conversation"
            className="h-8 w-full rounded-sm border border-transparent bg-surface-sunken pl-8 pr-7 text-13 text-fg placeholder:text-fg-faint hover:border-border focus-visible:border-ring focus-visible:bg-surface focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="absolute right-1.5 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-xs text-fg-faint hover:text-fg"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
        <div role="radiogroup" aria-label="Show" className="flex gap-1">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-12 font-medium focus-visible:outline-2 focus-visible:outline-ring",
                filter === f ? "bg-fg text-surface" : "text-fg-muted hover:bg-hover hover:text-fg",
              )}
            >
              {f === "all" ? "All" : "Unread"}
              {f === "unread" && totalUnread > 0 && <span className="tabular opacity-80">{totalUnread}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {q.isPending && workspaceId ? (
          <ListSkeleton />
        ) : !workspaceId || !q.data ? (
          <EmptyState
            compact
            tone="danger"
            icon={MessagesSquare}
            title="Couldn't load conversations"
            description={q.error ? errorMessage(q.error) : "Your workspace hasn't loaded yet."}
            action={
              workspaceId && (
                <Button size="sm" onClick={() => q.refetch()}>
                  <RotateCw aria-hidden /> Try again
                </Button>
              )
            }
          />
        ) : q.data.length === 0 ? (
          <EmptyState
            compact
            icon={MessagesSquare}
            title="No conversations yet"
            description="Message a teammate directly, or create a channel for a topic or team."
            action={
              <>
                <Button size="sm" variant="primary" onClick={() => openMessagesDialog("dm")}>
                  New message
                </Button>
                <Button size="sm" onClick={() => openMessagesDialog("browse")}>
                  Browse channels
                </Button>
              </>
            }
          />
        ) : shown.length === 0 ? (
          <p className="px-3 py-6 text-center text-13 text-fg-muted">
            {search ? `Nothing matches "${search.trim()}".` : "You're all caught up."}
          </p>
        ) : (
          <ul className="flex flex-col gap-px">
            {shown.map((c) => (
              <li key={c.id}>
                <Row c={c} active={c.id === activeId} meId={meId} people={people} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

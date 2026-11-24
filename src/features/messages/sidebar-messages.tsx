"use client";

import { Hash, Lock, MessagesSquare, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConversations } from "@/lib/api/hooks";
import type { Conversation } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { Avatar } from "@/ui/avatar";
import { CountBadge } from "@/ui/badge";
import { IconButton } from "@/ui/icon-button";
import { Skeleton } from "@/ui/skeleton";
import { SidebarSection } from "@/components/shell/sidebar-section";
import { NewConversationMenu } from "./conversation-list";
import { conversationLabel, conversationName, dmPartner } from "./format";
import { openMessagesDialog } from "./stores";

const rowBase =
  "flex h-[30px] items-center gap-2 rounded-sm px-2 text-13 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring";

function ConversationLink({ c, meId, onNavigate }: { c: Conversation; meId?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const href = `/messages/${c.id}`;
  const active = pathname === href;
  const partner = c.kind === "dm" ? dmPartner(c, meId) : undefined;
  const unread = c.unread_count > 0 && !active;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={`${conversationLabel(c, meId)}${unread ? `, ${c.unread_count} unread` : ""}`}
      className={cn(
        rowBase,
        active
          ? "bg-active font-medium text-fg"
          : unread
            ? "font-semibold text-fg hover:bg-hover"
            : "text-fg-muted hover:bg-hover hover:text-fg",
      )}
    >
      {partner ? (
        <Avatar user={partner} size="xs" decorative className="size-4 text-[8px]" />
      ) : c.is_private ? (
        <Lock className="size-3.5 shrink-0 text-fg-faint" aria-hidden />
      ) : (
        <Hash className="size-3.5 shrink-0 text-fg-faint" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate">{conversationName(c, meId)}</span>
      {unread && <CountBadge count={c.unread_count} className="bg-fg text-surface" />}
    </Link>
  );
}

/** Sidebar "Messages" group: channels, then DMs, with unread badges and a new-conversation menu. */
export function SidebarMessages({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { workspaceId, me } = useWorkspace();
  const meId = me?.user.id;
  const q = useConversations(workspaceId);
  const channels = (q.data ?? [])
    .filter((c) => c.kind === "channel")
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  const dms = (q.data ?? []).filter((c) => c.kind === "dm");
  const allActive = pathname === "/messages";

  const body = (list: Conversation[], empty: React.ReactNode) =>
    q.isPending && workspaceId ? (
      <div className="flex flex-col gap-2 py-1.5 pl-8" aria-hidden>
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    ) : !q.data || !workspaceId ? (
      <p className="px-2 py-1 text-12 text-fg-faint">
        Unavailable right now.{" "}
        {workspaceId && (
          <button type="button" className="underline-offset-2 hover:text-fg hover:underline" onClick={() => q.refetch()}>
            Retry
          </button>
        )}
      </p>
    ) : list.length === 0 ? (
      empty
    ) : (
      <ul className="flex flex-col gap-px">
        {list.map((c) => (
          <li key={c.id}>
            <ConversationLink c={c} meId={meId} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    );

  const quiet = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={() => {
        onClick();
        onNavigate?.();
      }}
      className={cn(rowBase, "w-full text-fg-faint hover:bg-hover hover:text-fg")}
    >
      <Plus className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <SidebarSection
      title="Messages"
      storageKey="messages"
      actions={
        <NewConversationMenu
          trigger={
            <IconButton label="New conversation" size="sm" tooltipSide="right" className="size-6">
              <Plus aria-hidden />
            </IconButton>
          }
        />
      }
    >
      <Link
        href="/messages"
        onClick={onNavigate}
        aria-current={allActive ? "page" : undefined}
        className={cn(rowBase, "gap-2.5", allActive ? "bg-active font-medium text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}
      >
        <MessagesSquare className={cn("size-4 shrink-0", allActive ? "text-fg" : "text-fg-faint")} strokeWidth={1.75} aria-hidden />
        <span className="min-w-0 flex-1 truncate">All messages</span>
      </Link>
      <h3 className="mt-2 px-2 pb-0.5 text-11 font-medium text-fg-faint">Channels</h3>
      {body(channels, quiet("Browse channels", () => openMessagesDialog("browse")))}
      {channels.length > 0 && quiet("Browse channels", () => openMessagesDialog("browse"))}
      <h3 className="mt-2 px-2 pb-0.5 text-11 font-medium text-fg-faint">Direct messages</h3>
      {body(dms, null)}
      {quiet("New message", () => openMessagesDialog("dm"))}
    </SidebarSection>
  );
}

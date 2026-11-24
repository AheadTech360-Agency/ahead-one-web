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
import { useLeaving, useRevealOnce, useSettled } from "@/components/shell/sidebar-motion";
import { sbRow, sbRowActive, sbRowIdle } from "@/components/shell/sidebar-styles";
import { NewConversationMenu } from "./conversation-list";
import { conversationLabel, conversationName, dmPartner } from "./format";
import { openMessagesDialog } from "./stores";

const rowBase = cn(sbRow, "gap-2 px-2");

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
      data-active={active}
      className={cn(rowBase, active ? sbRowActive : unread ? "font-semibold text-fg" : sbRowIdle)}
    >
      {partner ? (
        <Avatar user={partner} size="xs" decorative className="size-4 text-[8px]" />
      ) : c.is_private ? (
        <Lock className="size-3.5 shrink-0 text-fg-faint" aria-hidden />
      ) : (
        <Hash className="size-3.5 shrink-0 text-fg-faint" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate">{conversationName(c, meId)}</span>
      {unread && <CountBadge count={c.unread_count} animated />}
    </Link>
  );
}

/** One list of conversations: new ones fade in, removed ones collapse out, first load staggers once. */
function ConversationList({ list, meId, onNavigate }: { list: Conversation[]; meId?: string; onNavigate?: () => void }) {
  const items = useLeaving(list);
  const settled = useSettled(true);
  const reveal = useRevealOnce(true);
  return (
    <ul className="flex flex-col gap-px" data-sb-settled={settled} data-sb-reveal={reveal} suppressHydrationWarning>
      {items.map(({ item: c, leaving }) => (
        <li
          key={c.id}
          className="sb-item"
          data-leaving={leaving}
          aria-hidden={leaving || undefined}
          inert={leaving}
        >
          <div className="sb-item-inner">
            <ConversationLink c={c} meId={meId} onNavigate={onNavigate} />
          </div>
        </li>
      ))}
    </ul>
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
      <div className="flex flex-col gap-px" aria-hidden>
        {[60, 42].map((w) => (
          <div key={w} className="flex h-[30px] items-center gap-2 px-2">
            <Skeleton shimmer className="size-3.5 rounded-xs" />
            <Skeleton shimmer className="h-2.5" style={{ width: `${w}%` }} />
          </div>
        ))}
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
      <ConversationList list={list} meId={meId} onNavigate={onNavigate} />
    );

  const quiet = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={() => {
        onClick();
        onNavigate?.();
      }}
      className={cn(rowBase, "w-full text-fg-faint hover:text-fg")}
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
        data-active={allActive}
        className={cn(rowBase, "gap-2.5", allActive ? sbRowActive : sbRowIdle)}
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

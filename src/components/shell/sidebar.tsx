"use client";

import { Bell, CheckSquare, Hash, Home, Lock, MessagesSquare, Settings, Keyboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConversations, useUnreadCount } from "@/lib/api/hooks";
import type { Conversation } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { Avatar } from "@/ui/avatar";
import { CountBadge } from "@/ui/badge";
import { Skeleton } from "@/ui/skeleton";
import { useShell } from "./shell-context";
import { SidebarSection } from "./sidebar-section";
import { SpacesTree } from "./spaces-tree";
import { WorkspaceSwitcher } from "./workspace-switcher";

function NavLink({
  href,
  icon: Icon,
  label,
  count,
  exact,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean; strokeWidth?: number }>;
  label: string;
  count?: number;
  exact?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-[30px] items-center gap-2.5 rounded-sm px-2 text-13",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
        active ? "bg-active font-medium text-fg" : "text-fg-muted hover:bg-hover hover:text-fg",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-fg" : "text-fg-faint")} strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-12 font-medium text-fg-muted tabular" aria-label={`${count} unread`}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

function ConversationLink({ c, meId, onNavigate }: { c: Conversation; meId?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const href = `/messages/${c.id}`;
  const active = pathname === href;
  const other = c.kind === "dm" ? c.members.find((m) => m.id !== meId) ?? c.members[0] : undefined;
  const name = c.kind === "dm" ? other?.full_name || other?.email || "Direct message" : c.name ?? "Untitled channel";
  const unread = c.unread_count > 0;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-[30px] items-center gap-2 rounded-sm px-2 text-13",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
        active
          ? "bg-active font-medium text-fg"
          : unread
            ? "font-semibold text-fg hover:bg-hover"
            : "text-fg-muted hover:bg-hover hover:text-fg",
      )}
    >
      {c.kind === "dm" && other ? (
        <Avatar user={other} size="xs" decorative className="size-4 text-[8px]" />
      ) : c.is_private ? (
        <Lock className="size-3.5 shrink-0 text-fg-faint" aria-label="Private channel" />
      ) : (
        <Hash className="size-3.5 shrink-0 text-fg-faint" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {unread && <CountBadge count={c.unread_count} className="bg-fg text-surface" />}
    </Link>
  );
}

function MessagesSection({ onNavigate }: { onNavigate?: () => void }) {
  const { workspaceId, me } = useWorkspace();
  const conversations = useConversations(workspaceId);
  const channels = conversations.data?.filter((c) => c.kind === "channel") ?? [];
  const dms = conversations.data?.filter((c) => c.kind === "dm") ?? [];

  const body = (list: Conversation[], empty: string) =>
    conversations.isPending && workspaceId ? (
      <div className="flex flex-col gap-1 py-1 pl-8" aria-hidden>
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    ) : conversations.isError || !workspaceId ? (
      <p className="px-2 py-1 text-12 text-fg-faint">Unavailable right now.</p>
    ) : list.length === 0 ? (
      <p className="px-2 py-1 text-12 text-fg-faint">{empty}</p>
    ) : (
      <ul className="flex flex-col gap-px">
        {list.map((c) => (
          <li key={c.id}>
            <ConversationLink c={c} meId={me?.user.id} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    );

  return (
    <SidebarSection title="Messages" storageKey="messages">
      <NavLink href="/messages" icon={MessagesSquare} label="All messages" exact onNavigate={onNavigate} />
      <p className="mt-1.5 px-2 text-11 text-fg-faint">Channels</p>
      {body(channels, "No channels yet.")}
      <p className="mt-1.5 px-2 text-11 text-fg-faint">Direct messages</p>
      {body(dms, "No conversations yet.")}
    </SidebarSection>
  );
}

/** Sidebar body, shared by the desktop column and the mobile drawer. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const unread = useUnreadCount();
  const { setShortcutsOpen } = useShell();
  return (
    <div className="flex h-full flex-col">
      <div className="px-2 pt-2">
        <WorkspaceSwitcher />
      </div>
      <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">
        <div className="flex flex-col gap-px pt-2">
          <NavLink href="/" icon={Home} label="Home" exact onNavigate={onNavigate} />
          <NavLink href="/my-tasks" icon={CheckSquare} label="My tasks" onNavigate={onNavigate} />
          <NavLink
            href="/inbox"
            icon={Bell}
            label="Inbox"
            count={unread.data?.count}
            onNavigate={onNavigate}
          />
        </div>
        <div className="mt-5 flex flex-col gap-5">
          <MessagesSection onNavigate={onNavigate} />
          <SpacesTree onNavigate={onNavigate} />
        </div>
      </nav>
      <div className="flex flex-col gap-px border-t border-border px-2 py-2">
        <NavLink href="/settings" icon={Settings} label="Settings" onNavigate={onNavigate} />
        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          className="flex h-[30px] items-center gap-2.5 rounded-sm px-2 text-13 text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
        >
          <Keyboard className="size-4 text-fg-faint" strokeWidth={1.75} aria-hidden />
          <span className="flex-1 text-left">Keyboard shortcuts</span>
          <kbd className="font-sans text-12 text-fg-faint">?</kbd>
        </button>
      </div>
    </div>
  );
}

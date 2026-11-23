"use client";

import { formatDistanceToNowStrict } from "date-fns";
import {
  AtSign,
  Bell,
  CalendarClock,
  CheckCheck,
  CircleAlert,
  MessageSquare,
  RotateCw,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/lib/api/client";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from "@/lib/api/hooks";
import type { Notification, NotificationKind } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { CountBadge } from "@/ui/badge";
import { EmptyState } from "@/ui/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { Skeleton } from "@/ui/skeleton";
import { Tooltip } from "@/ui/tooltip";

export const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  task_assigned: UserPlus,
  mentioned: AtSign,
  task_comment: MessageSquare,
  task_due_soon: CalendarClock,
  task_overdue: CircleAlert,
  direct_message: MessageSquare,
};

/** Only follow in-app links from notifications. */
function safeLink(link: string) {
  return link.startsWith("/") && !link.startsWith("//") ? link : "/inbox";
}

export function NotificationRow({
  n,
  onOpen,
}: {
  n: Notification;
  onOpen: (n: Notification) => void;
}) {
  const Icon = KIND_ICON[n.kind] ?? Bell;
  const unread = !n.read_at;
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={cn(
        "group flex w-full items-start gap-3 rounded-sm px-3 py-2.5 text-left hover:bg-hover",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
      )}
    >
      <span className="relative mt-0.5 shrink-0">
        {n.actor ? (
          <Avatar user={n.actor} size="md" decorative />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-active text-fg-muted">
            <Icon className="size-4" aria-hidden />
          </span>
        )}
        {n.actor && (
          <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-surface-raised text-fg-muted ring-1 ring-border">
            <Icon className="size-2.5" aria-hidden />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-13", unread ? "font-medium text-fg" : "text-fg-muted")}>
          {n.title}
        </span>
        {n.body && <span className="mt-0.5 line-clamp-2 block text-12 text-fg-muted">{n.body}</span>}
        <span className="mt-1 block text-11 text-fg-faint">
          {formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}
        </span>
      </span>
      {unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
    </button>
  );
}

export function useOpenNotification(close?: () => void) {
  const router = useRouter();
  const markRead = useMarkNotificationRead();
  return (n: Notification) => {
    if (!n.read_at) markRead.mutate(n.id);
    close?.();
    router.push(safeLink(n.link));
  };
}

export function NotificationList({
  unreadOnly,
  onOpen,
  limit,
}: {
  unreadOnly: boolean;
  onOpen: (n: Notification) => void;
  limit?: number;
}) {
  const q = useNotifications(unreadOnly);
  if (q.isPending) {
    return (
      <div className="flex flex-col" role="status" aria-label="Loading notifications">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3 px-3 py-2.5">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5 pt-1">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2.5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (q.isError) {
    return (
      <EmptyState
        compact
        icon={CircleAlert}
        tone="danger"
        title="Couldn't load notifications"
        description={errorMessage(q.error)}
        action={
          <Button size="sm" variant="secondary" onClick={() => q.refetch()}>
            <RotateCw aria-hidden /> Retry
          </Button>
        }
      />
    );
  }
  const items = q.data.pages.flatMap((p) => p.items);
  const shown = limit ? items.slice(0, limit) : items;
  if (items.length === 0) {
    return (
      <EmptyState
        compact
        icon={CheckCheck}
        title={unreadOnly ? "You're all caught up" : "No notifications yet"}
        description={
          unreadOnly
            ? "New assignments, mentions and due dates show up here."
            : "When someone assigns you a task or mentions you, it lands here."
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-px p-1">
      {shown.map((n) => (
        <NotificationRow key={n.id} n={n} onOpen={onOpen} />
      ))}
      {!limit && q.hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          className="mx-auto my-2"
          loading={q.isFetchingNextPage}
          onClick={() => q.fetchNextPage()}
        >
          Load older
        </Button>
      )}
    </div>
  );
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const count = useUnreadCount().data?.count ?? 0;
  const markAll = useMarkAllNotificationsRead();
  const onOpen = useOpenNotification(() => setOpen(false));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="Notifications">
        <PopoverTrigger
          aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
          className={cn(
            "relative inline-flex size-8 items-center justify-center rounded-sm text-fg-muted",
            "hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:bg-active data-[state=open]:text-fg",
          )}
        >
          <Bell className="size-4" aria-hidden />
          <CountBadge count={count} className="absolute -right-0.5 -top-0.5 ring-2 ring-bg" />
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end" className="flex max-h-[min(560px,80vh)] w-[min(400px,calc(100vw-16px))] flex-col p-0">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-subtle pl-3 pr-2">
          <h2 className="text-14 font-semibold">Notifications</h2>
          <div className="flex items-center gap-1">
            <div role="radiogroup" aria-label="Show" className="flex rounded-sm bg-surface-sunken p-0.5">
              {(["unread", "all"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={tab === t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "h-6 rounded-xs px-2 text-12 font-medium capitalize focus-visible:outline-2 focus-visible:outline-ring",
                    tab === t ? "bg-surface-raised text-fg shadow-xs" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <Tooltip content="Mark all as read">
              <button
                type="button"
                aria-label="Mark all as read"
                disabled={count === 0 || markAll.isPending}
                onClick={() => markAll.mutate()}
                className="inline-flex size-7 items-center justify-center rounded-sm text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
              >
                <CheckCheck className="size-4" aria-hidden />
              </button>
            </Tooltip>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NotificationList unreadOnly={tab === "unread"} onOpen={onOpen} limit={20} />
        </div>
        <div className="shrink-0 border-t border-border-subtle p-1.5">
          <Link
            href="/inbox"
            onClick={() => setOpen(false)}
            className="flex h-8 items-center justify-center rounded-sm text-13 font-medium text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
          >
            Open inbox
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

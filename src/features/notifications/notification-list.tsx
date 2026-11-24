"use client";

import { formatDistanceToNowStrict, isSameDay } from "date-fns";
import {
  AtSign,
  Bell,
  CalendarClock,
  Check,
  CheckCheck,
  CircleAlert,
  MessageSquare,
  MessagesSquare,
  RotateCw,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useEffect, useRef } from "react";
import { errorMessage } from "@/lib/api/client";
import { useNotifications } from "@/lib/api/hooks";
import type { Notification, NotificationKind } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { IconButton } from "@/ui/icon-button";
import { Skeleton } from "@/ui/skeleton";
import { Spinner } from "@/ui/spinner";
import { dayLabel } from "@/features/messages/format";
import { useMarkRead } from "./api";

export const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  task_assigned: UserPlus,
  mentioned: AtSign,
  task_comment: MessageSquare,
  task_due_soon: CalendarClock,
  task_overdue: CircleAlert,
  direct_message: MessagesSquare,
};

export const KIND_LABEL: Record<NotificationKind, string> = {
  task_assigned: "Assigned",
  mentioned: "Mention",
  task_comment: "Comment",
  task_due_soon: "Due soon",
  task_overdue: "Overdue",
  direct_message: "Message",
};

/** Due dates are the only kinds that carry colour: they ask for action. */
const KIND_TONE: Partial<Record<NotificationKind, string>> = {
  task_overdue: "text-danger-text",
  task_due_soon: "text-warning-text",
};

export function NotificationRow({
  n,
  onOpen,
  dense,
}: {
  n: Notification;
  onOpen: (n: Notification) => void;
  dense?: boolean;
}) {
  const Icon = KIND_ICON[n.kind] ?? Bell;
  const unread = !n.read_at;
  const markRead = useMarkRead();
  return (
    <div className="group/n relative flex items-start rounded-sm hover:bg-hover">
      <button
        type="button"
        onClick={() => onOpen(n)}
        className={cn(
          "flex min-w-0 flex-1 items-start gap-3 rounded-sm text-left",
          dense ? "px-3 py-2.5" : "px-3 py-3",
          "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
        )}
      >
        <span className="mt-0.5 shrink-0">
          {n.actor ? (
            <Avatar user={n.actor} size="md" decorative />
          ) : (
            <span className={cn("flex size-8 items-center justify-center rounded-full bg-active text-fg-muted", KIND_TONE[n.kind])}>
              <Icon className="size-4" strokeWidth={1.75} aria-hidden />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1 pr-6">
          <span className={cn("block text-13", unread ? "font-semibold text-fg" : "text-fg-muted")}>{n.title}</span>
          {n.body && <span className={cn("mt-0.5 line-clamp-2 block text-12", unread ? "text-fg" : "text-fg-muted")}>{n.body}</span>}
          <span className="mt-1 flex items-center gap-1.5 text-11 text-fg-faint">
            <span className={cn("inline-flex items-center gap-1 font-medium", KIND_TONE[n.kind] ?? "text-fg-muted")}>
              <Icon className="size-3" strokeWidth={2} aria-hidden />
              {KIND_LABEL[n.kind] ?? "Update"}
            </span>
            <time dateTime={n.created_at}>{formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}</time>
          </span>
        </span>
        {unread && <span className="sr-only">Unread</span>}
      </button>
      {unread && (
        <>
          <span aria-hidden className="pointer-events-none absolute right-3.5 top-4 size-2 rounded-full bg-green group-hover/n:opacity-0 group-focus-within/n:opacity-0" />
          <IconButton
            label="Mark as read"
            size="sm"
            className="absolute right-1.5 top-2 opacity-0 group-hover/n:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:hidden"
            onClick={() => markRead.mutate(n.id)}
          >
            <Check aria-hidden />
          </IconButton>
        </>
      )}
    </div>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col p-1" role="status" aria-label="Loading notifications">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3 px-3 py-3" aria-hidden>
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5 pt-1">
            <Skeleton className="h-3" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Notification feed. `limit` shows the first N (popover); without it the list groups by day
 * and loads older pages as you scroll (inbox).
 */
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
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || limit) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [q, limit]);

  if (q.isPending) return <ListSkeleton rows={limit ? 3 : 6} />;
  if (q.isError && !q.data) {
    return (
      <EmptyState
        compact
        icon={CircleAlert}
        tone="danger"
        title="Couldn't load notifications"
        description={errorMessage(q.error)}
        action={
          <Button size="sm" variant="secondary" onClick={() => q.refetch()}>
            <RotateCw aria-hidden /> Try again
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
            ? "New assignments, mentions, messages and due dates show up here."
            : "When someone assigns you a task, mentions you or sends you a message, it lands here."
        }
      />
    );
  }

  if (limit) {
    return (
      <div className="flex flex-col gap-px p-1">
        {shown.map((n) => (
          <NotificationRow key={n.id} n={n} onOpen={onOpen} dense />
        ))}
      </div>
    );
  }

  const withDays = shown.map((n, i) => {
    const d = new Date(n.created_at);
    return { n, d, newDay: i === 0 || !isSameDay(new Date(shown[i - 1].created_at), d) };
  });
  return (
    <div className="flex flex-col gap-px">
      {withDays.map(({ n, d, newDay }) => {
        return (
          <Fragment key={n.id}>
            {newDay && <h2 className="px-3 pb-1 pt-4 text-12 font-medium text-fg-muted first:pt-1">{dayLabel(d)}</h2>}
            <NotificationRow n={n} onOpen={onOpen} />
          </Fragment>
        );
      })}
      <div ref={sentinel} className="flex h-12 items-center justify-center text-12 text-fg-faint">
        {q.isFetchingNextPage ? (
          <Spinner size={16} label="Loading older notifications" />
        ) : q.hasNextPage ? (
          <Button variant="ghost" size="sm" onClick={() => q.fetchNextPage()}>
            Load older
          </Button>
        ) : items.length > 8 ? (
          "That's everything."
        ) : null}
      </div>
    </div>
  );
}

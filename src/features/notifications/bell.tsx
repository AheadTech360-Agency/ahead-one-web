"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useUnreadCount } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { CountBadge } from "@/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { Tooltip } from "@/ui/tooltip";
import { PushPrompt } from "@/features/push/push-controls";
import { useMarkAllRead, useOpenNotification } from "./api";
import { NotificationList } from "./notification-list";

/** Top bar bell: live unread count (bumped by notification.created) and the recent feed. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const count = useUnreadCount().data?.count ?? 0;
  const markAll = useMarkAllRead();
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
      <PopoverContent
        align="end"
        aria-label="Notifications"
        className="flex max-h-[min(600px,calc(100dvh-64px))] w-[min(400px,calc(100vw-16px))] flex-col p-0"
      >
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border-subtle pl-3 pr-1.5">
          <h2 className="text-14 font-semibold text-fg">
            Notifications
            {count > 0 && <span className="ml-1.5 font-normal text-fg-muted tabular">{count} unread</span>}
          </h2>
          <div className="flex items-center gap-1">
            <div role="radiogroup" aria-label="Show" className="flex rounded-sm bg-surface-sunken p-0.5">
              {(["all", "unread"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={tab === t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "h-6 rounded-xs px-2 text-12 font-medium focus-visible:outline-2 focus-visible:outline-ring",
                    tab === t ? "bg-surface-raised text-fg shadow-xs dark:bg-border-strong" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {t === "all" ? "All" : "Unread"}
                </button>
              ))}
            </div>
            <Tooltip content="Mark all as read">
              <button
                type="button"
                aria-label="Mark all as read"
                disabled={count === 0 || markAll.isPending}
                onClick={() => markAll.mutate()}
                className="inline-flex size-7 items-center justify-center rounded-sm text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40"
              >
                <CheckCheck className="size-4" aria-hidden />
              </button>
            </Tooltip>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <NotificationList unreadOnly={tab === "unread"} onOpen={onOpen} limit={20} />
        </div>
        <PushPrompt />
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

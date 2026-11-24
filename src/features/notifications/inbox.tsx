"use client";

import { CheckCheck, Settings2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageBody, PageHeader } from "@/components/page";
import { useUnreadCount } from "@/lib/api/hooks";
import { Button, buttonClasses } from "@/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";
import { useMarkAllRead, useOpenNotification } from "./api";
import { NotificationList } from "./notification-list";

/** Inbox: every notification, All / Unread, grouped by day, older pages load as you scroll. */
export function InboxView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = params.get("tab") === "unread" ? "unread" : "all";
  const unread = useUnreadCount().data?.count ?? 0;
  const markAll = useMarkAllRead();
  const onOpen = useOpenNotification();

  return (
    <PageBody width="narrow">
      <PageHeader
        title="Inbox"
        description={unread ? `${unread} unread` : "Assignments, mentions, messages and due dates"}
        actions={
          <>
            <Link href="/settings?tab=notifications" className={buttonClasses({ variant: "ghost" })}>
              <Settings2 aria-hidden /> Settings
            </Link>
            <Button variant="secondary" disabled={unread === 0} loading={markAll.isPending} onClick={() => markAll.mutate()}>
              <CheckCheck aria-hidden /> Mark all as read
            </Button>
          </>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(v) => router.replace(v === "all" ? pathname : `${pathname}?tab=${v}`, { scroll: false })}
        className="mt-5"
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {unread > 0 && (
              <span className="rounded-full bg-active px-1.5 text-11 font-medium text-fg-muted tabular">{unread > 99 ? "99+" : unread}</span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="mt-2">
        <NotificationList key={tab} unreadOnly={tab === "unread"} onOpen={onOpen} />
      </div>
    </PageBody>
  );
}

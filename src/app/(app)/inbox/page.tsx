"use client";

import { CheckCheck } from "lucide-react";
import { useState } from "react";
import { PageBody, PageHeader } from "@/components/page";
import { NotificationList, useOpenNotification } from "@/components/shell/notification-center";
import { useMarkAllNotificationsRead, useUnreadCount } from "@/lib/api/hooks";
import { Button } from "@/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";

export default function InboxPage() {
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const unread = useUnreadCount().data?.count ?? 0;
  const markAll = useMarkAllNotificationsRead();
  const onOpen = useOpenNotification();

  return (
    <PageBody width="narrow">
      <PageHeader
        title="Inbox"
        description={unread ? `${unread} unread` : "Assignments, mentions and due dates"}
        actions={
          <Button
            variant="secondary"
            disabled={unread === 0}
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck aria-hidden /> Mark all as read
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as "unread" | "all")} className="mt-5">
        <TabsList>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="mt-2">
        <NotificationList unreadOnly={tab === "unread"} onOpen={onOpen} />
      </div>
    </PageBody>
  );
}

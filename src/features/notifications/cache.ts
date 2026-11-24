import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/api/keys";
import type { Notification, Page, UnreadCount } from "@/lib/api/types";

type NotificationPages = InfiniteData<Page<Notification>, string | undefined>;

/** A new notification: front of both lists and +1 on the badge. */
export function addNotification(qc: QueryClient, n: Notification) {
  const prepend = (data: NotificationPages | undefined) => {
    if (!data || data.pages.length === 0) return data;
    if (data.pages.some((p) => p.items.some((x) => x.id === n.id))) return data;
    const [first, ...rest] = data.pages;
    return { ...data, pages: [{ ...first, items: [n, ...first.items] }, ...rest] };
  };
  qc.setQueryData<NotificationPages>(qk.notifications.list(false), prepend);
  if (!n.read_at) {
    qc.setQueryData<NotificationPages>(qk.notifications.list(true), prepend);
    qc.setQueryData<UnreadCount>(qk.notifications.unreadCount(), (c) => (c ? { count: c.count + 1 } : c));
  }
}

/** Optimistically mark one (or every) notification read. Returns a rollback. */
export function markNotificationsRead(qc: QueryClient, id: string | "all") {
  const now = new Date().toISOString();
  const snapshot = qc.getQueriesData({ queryKey: qk.notifications.all });
  let cleared = 0;
  const mark = (data: NotificationPages | undefined) =>
    data
      ? {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            items: p.items.map((n) => {
              if (n.read_at || (id !== "all" && n.id !== id)) return n;
              return { ...n, read_at: now };
            }),
          })),
        }
      : data;
  const all = qc.getQueryData<NotificationPages>(qk.notifications.list(false));
  const unread = qc.getQueryData<NotificationPages>(qk.notifications.list(true));
  if (id !== "all") {
    const n = [...(all?.pages ?? []), ...(unread?.pages ?? [])].flatMap((p) => p.items).find((x) => x.id === id);
    cleared = n && !n.read_at ? 1 : 0;
  }
  qc.setQueryData<NotificationPages>(qk.notifications.list(false), mark);
  // Keep read rows in the Unread tab until the next refetch, so the list doesn't jump under the pointer.
  qc.setQueryData<NotificationPages>(qk.notifications.list(true), mark);
  qc.setQueryData<UnreadCount>(qk.notifications.unreadCount(), (c) =>
    c ? { count: id === "all" ? 0 : Math.max(0, c.count - cleared) } : c,
  );
  return () => snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
}

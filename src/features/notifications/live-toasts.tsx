"use client";

import { usePathname, useRouter } from "next/navigation";
import { toast } from "@/ui/toaster";
import { useRealtimeEvent } from "@/features/realtime/provider";
import { useMarkRead } from "./api";
import { deepLink } from "./kinds";

/**
 * While the tab is in front, a new message or mention also shows as a toast, unless you're
 * already looking at the conversation it points to. Everything else only bumps the bell.
 */
export function LiveNotificationToasts() {
  const pathname = usePathname();
  const router = useRouter();
  const markRead = useMarkRead();

  useRealtimeEvent((ev) => {
    if (ev.type !== "notification.created") return;
    const n = ev.notification;
    if (n.read_at || document.visibilityState !== "visible") return;
    // Every kind toasts except the quiet system ones; a notification for the conversation on screen stays silent.
    if (n.kind === "app_update") return;
    const link = deepLink(n.kind, n.link);
    if (link === pathname) return;
    toast(n.title, {
      id: n.id,
      description: n.body || undefined,
      action: {
        label: "Open",
        onClick: () => {
          markRead.mutate(n.id);
          router.push(link);
        },
      },
    });
  });

  return null;
}

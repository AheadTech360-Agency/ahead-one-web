"use client";

import { usePathname, useRouter } from "next/navigation";
import { toast } from "@/ui/toaster";
import { useRealtimeEvent } from "@/features/realtime/provider";
import { safeLink, useMarkRead } from "./api";

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
    if (n.kind !== "direct_message" && n.kind !== "mentioned" && n.kind !== "task_assigned") return;
    const link = safeLink(n.link);
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

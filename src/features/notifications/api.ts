"use client";

import { safeNext } from "@/lib/safe-next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { Notification } from "@/lib/api/types";
import { toast } from "@/ui/toaster";
import { markNotificationsRead } from "./cache";

/** Mark one read. The row and the badge update at once and roll back if the request fails. */
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/notifications/${id}/read`, { method: "POST" }),
    onMutate: (id) => ({ rollback: markNotificationsRead(qc, id) }),
    onError: (e, _id, ctx) => {
      ctx?.rollback();
      toast.error("Couldn't mark it as read", { description: errorMessage(e) });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notifications.unreadCount() }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/v1/notifications/read-all", { method: "POST" }),
    onMutate: () => ({ rollback: markNotificationsRead(qc, "all") }),
    onError: (e, _v, ctx) => {
      ctx?.rollback();
      toast.error("Couldn't mark everything as read", { description: errorMessage(e) });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notifications.all }),
  });
}

/** Only follow app-relative links from notifications. */
export function safeLink(link: string) {
  return safeNext(link, "/inbox");
}

export function useOpenNotification(after?: () => void) {
  const router = useRouter();
  const markRead = useMarkRead();
  return (n: Notification) => {
    if (!n.read_at) markRead.mutate(n.id);
    after?.();
    router.push(safeLink(n.link));
  };
}

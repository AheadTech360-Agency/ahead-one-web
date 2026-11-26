"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useConversations, useUnreadCount } from "@/lib/api/hooks";
import { useWorkspace } from "@/lib/workspace";
import { titleWithCount, totalUnread } from "@/features/messages/cache-patch";
import { useRealtimeStatus } from "./provider";

/** How long the connection must stay down before anything is shown: short drops are invisible. */
export const BANNER_DELAY_MS = 4_000;

/** A subtle strip that appears only after the socket has been down for a few seconds. */
export function ConnectionBanner() {
  const status = useRealtimeStatus();
  if (status !== "offline" && status !== "reconnecting") return null;
  return <DownNote offline={status === "offline"} />;
}

/** Mounted only while the connection is down, so each outage starts its own delay and short drops never show. */
function DownNote({ offline }: { offline: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), BANNER_DELAY_MS);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 top-0 z-[var(--z-popover)] flex justify-center px-3 pt-2 animate-in-fade">
      <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-1 text-12 font-medium text-fg-muted shadow-popover">
        <WifiOff className="size-3.5 text-warning-text" aria-hidden />
        {offline ? "You're offline. Messages will catch up when you're back." : "Reconnecting. Messages may be a moment behind."}
      </p>
    </div>
  );
}

function drawFavicon(count: number, base: HTMLImageElement | null): string | null {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (base) ctx.drawImage(base, 0, 0, size, size);
  if (count > 0) {
    ctx.fillStyle = "#e5484d";
    ctx.beginPath();
    ctx.arc(size - 20, 20, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(count > 9 ? "9+" : String(count), size - 20, 21);
  }
  return canvas.toDataURL("image/png");
}

/**
 * Unread messages plus unread notifications in the tab title ("(3) Inbox | AheadOne") and on the
 * favicon. Titles other code sets (the open conversation) are kept: the count prefix is re-applied
 * whenever <title> changes.
 */
export function UnreadIndicator() {
  const { workspaceId } = useWorkspace();
  const conversations = useConversations(workspaceId);
  const notifications = useUnreadCount();
  const count = totalUnread(conversations.data) + (notifications.data?.count ?? 0);

  useEffect(() => {
    const apply = () => {
      const next = titleWithCount(document.title, count);
      if (next !== document.title) document.title = next;
    };
    apply();
    const el = document.querySelector("title");
    if (!el) return;
    const mo = new MutationObserver(apply);
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    return () => {
      mo.disconnect();
      document.title = titleWithCount(document.title, 0);
    };
  }, [count]);

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"][data-unread]');
    const original = document.querySelector<HTMLLinkElement>('link[rel~="icon"]:not([data-unread])');
    if (count === 0) {
      link?.remove();
      return;
    }
    const img = new Image();
    img.onload = () => {
      const url = drawFavicon(count, img);
      if (!url) return;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        link.setAttribute("data-unread", "1");
        document.head.appendChild(link);
      }
      link.type = "image/png";
      link.href = url;
    };
    img.onerror = () => undefined;
    img.src = original?.href ?? "/icon.svg";
    return () => {
      img.onload = null;
    };
  }, [count]);

  return null;
}

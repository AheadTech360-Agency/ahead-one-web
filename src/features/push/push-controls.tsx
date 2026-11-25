"use client";

import { BellRing, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { errorMessage, isApiError } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import { Button } from "@/ui/button";
import { Switch } from "@/ui/checkbox";
import { IconButton } from "@/ui/icon-button";
import { toast } from "@/ui/toaster";
import { disablePush, dismissPushPrompt, enablePush, refreshPushToken, usePushState } from "./push";

function useToggle() {
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const refreshStatus = () => qc.invalidateQueries({ queryKey: qk.notifications.channels() });
  async function turnOn() {
    setBusy(true);
    try {
      const p = await enablePush();
      if (p === "granted") toast.success("Browser notifications are on");
      else if (p === "denied")
        toast.error("Notifications are blocked for this site", {
          description: "Allow them in your browser's site settings, then try again.",
        });
    } catch (e) {
      toast.error("Couldn't turn on browser notifications", {
        description: isApiError(e) ? errorMessage(e) : e instanceof Error ? e.message : "Try again in a moment.",
      });
    } finally {
      setBusy(false);
      void refreshStatus();
    }
  }
  async function turnOff() {
    setBusy(true);
    try {
      await disablePush();
      toast.success("Browser notifications are off");
    } finally {
      setBusy(false);
      void refreshStatus();
    }
  }
  return { busy, turnOn, turnOff };
}

/** Settings > Notifications: the per-browser push switch. */
export function BrowserPushControl() {
  const s = usePushState();
  const { busy, turnOn, turnOff } = useToggle();

  const description = !s.available
    ? s.permission === "unsupported"
      ? "Not available here. Push needs a supported browser over HTTPS, and it has to be set up for this workspace."
      : "Not available in this browser."
    : s.permission === "denied"
      ? "Blocked in your browser. Allow notifications for this site in the browser's site settings, then turn this on."
      : "Get a desktop notification when you're away from AheadOne. Applies to this browser only.";

  return (
    <Switch
      label="Browser notifications"
      description={description}
      checked={s.enabled}
      disabled={!s.available || busy || (s.permission === "denied" && !s.enabled)}
      onCheckedChange={(on) => void (on ? turnOn() : turnOff())}
    />
  );
}

/** Dismissible nudge in the notification popover. Never asks on its own: the button does. */
export function PushPrompt() {
  const s = usePushState();
  const { busy, turnOn } = useToggle();
  if (!s.available || s.enabled || s.dismissed || s.permission !== "default") return null;
  return (
    <div className="flex items-start gap-2.5 border-t border-border-subtle bg-surface-sunken px-3 py-2.5">
      <BellRing className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-12 font-medium text-fg">Get notified when you&apos;re away</p>
        <p className="text-12 text-fg-muted">Desktop alerts for messages, mentions and assignments.</p>
        <Button size="sm" variant="secondary" className="mt-2" loading={busy} onClick={() => void turnOn()}>
          Turn on
        </Button>
      </div>
      <IconButton label="Dismiss" size="sm" className="-mr-1 -mt-1" onClick={dismissPushPrompt}>
        <X aria-hidden />
      </IconButton>
    </div>
  );
}

/** Keeps an already-granted push token current. Never prompts. */
export function PushSync() {
  useEffect(() => {
    void refreshPushToken();
  }, []);
  return null;
}

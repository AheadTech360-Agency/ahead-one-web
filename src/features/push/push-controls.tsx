"use client";

import { BellRing, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { errorMessage, isApiError } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import { clearFreshLogin, hasFreshLogin } from "@/lib/auth/fresh-login";
import { Button } from "@/ui/button";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/ui/dialog";
import { Switch } from "@/ui/checkbox";
import { IconButton } from "@/ui/icon-button";
import { toast } from "@/ui/toaster";
import { disablePush, dismissPushPrompt, enablePush, refreshPushToken, resetPushDismissed, usePushState } from "./push";
import { decidePushLogin } from "./push-decision";

function useToggle() {
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const refreshStatus = () => qc.invalidateQueries({ queryKey: qk.notifications.channels() });
  async function turnOn(): Promise<NotificationPermission | null> {
    setBusy(true);
    try {
      const p = await enablePush();
      if (p === "granted") toast.success("Browser notifications are on");
      else if (p === "denied")
        toast.error("Notifications are blocked for this site", {
          description: "Allow them in your browser's site settings, then try again.",
        });
      return p;
    } catch (e) {
      toast.error("Couldn't turn on browser notifications", {
        description: isApiError(e) ? errorMessage(e) : e instanceof Error ? e.message : "Try again in a moment.",
      });
      return null;
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

const ICON_TILE = "grid size-11 shrink-0 place-items-center rounded-md bg-accent text-fg-on-accent";

/**
 * After every sign-in, notifications are on by default and the browser is asked once.
 * - Permission undecided: a dialog explains what they are for; "Turn on notifications" is the click
 *   that lets the browser show its prompt. "Not now" only skips this sign-in.
 * - Already allowed but this browser has no token: registered silently.
 * - Blocked: one small notice with a way to Settings, no dialog.
 * Runs only while the fresh sign-in flag is set, so page loads and new tabs stay quiet.
 */
export function PushLoginPrompt() {
  const s = usePushState();
  const router = useRouter();
  const { busy, turnOn } = useToggle();
  const [open, setOpen] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const action = decidePushLogin({
      available: s.available,
      permission: s.permission,
      enabled: s.enabled,
      freshLogin: hasFreshLogin(),
    });
    if (action === "none") {
      // Already on (or unsupported): nothing to ask for this sign-in.
      if (hasFreshLogin() && s.available && s.enabled) clearFreshLogin();
      return;
    }
    handled.current = true;
    resetPushDismissed();
    if (action === "offer") {
      // One-shot reaction to the external push/login state, guarded by `handled`.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
      return;
    }
    clearFreshLogin();
    if (action === "silent-register") {
      void enablePush().catch(() => {
        // Quiet by design: the settings switch shows the real state and lets them retry.
      });
      return;
    }
    toast.info("Notifications are blocked in this browser", {
      description: "To get alerts, allow notifications for this site in your browser's site settings.",
      duration: 12_000,
      action: { label: "Open settings", onClick: () => router.push("/settings") },
    });
  }, [s.available, s.permission, s.enabled, router]);

  function close() {
    clearFreshLogin();
    setOpen(false);
  }

  async function accept() {
    const p = await turnOn();
    if (p !== null) close();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent
        size="sm"
        hideClose
        title="Turn on notifications"
        description="Stay in the loop when you're not looking at AheadOne."
      >
        <DialogBody>
          <div className="flex items-start gap-3">
            <span className={ICON_TILE} aria-hidden>
              <BellRing className="size-5" />
            </span>
            <ul className="flex flex-col gap-1.5 text-13 text-fg">
              <li>Direct messages and channel replies</li>
              <li>Mentions of you in tasks and comments</li>
              <li>Tasks assigned to you</li>
            </ul>
          </div>
          <p className="mt-3 text-12 text-fg-muted">
            Your browser will ask for permission next. You can change this any time in Settings.
          </p>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Not now</Button>
          </DialogClose>
          <Button variant="primary" loading={busy} onClick={() => void accept()}>
            Turn on notifications
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

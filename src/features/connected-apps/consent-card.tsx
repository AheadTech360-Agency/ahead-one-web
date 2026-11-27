"use client";

import { Ban, Clock, Globe, Link2Off, ShieldAlert, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Skeleton } from "@/ui/skeleton";
import type { OAuthRequestInfo } from "./contract";
import { allowSummary, canAllow, defaultSelection, displayHost, groupScopes, orderLike, toggleScope } from "./logic";

export type ConsentPhase = "idle" | "submitting" | "redirecting" | "error";

const NEVER = [
  "Delete anything",
  "Change anyone's role",
  "Invite people",
  "See other people's private tasks",
];

/**
 * The consent screen. Presentational: the container owns the request, the decision call and the
 * navigation. The app name is only ever rendered as a React text node (escaped), and truncated so a
 * hostile name cannot take over the layout.
 */
export function ConsentCard({
  info,
  userName,
  userEmail,
  phase,
  error,
  onDecide,
}: {
  info: OAuthRequestInfo;
  userName: string | undefined;
  userEmail?: string;
  phase: ConsentPhase;
  error?: string;
  onDecide: (approve: boolean, scopes: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(() => defaultSelection(info.scopes));
  const groups = groupScopes(info.scopes);
  const host = displayHost(info.redirect_uri, info.redirect_host);
  const busy = phase === "submitting" || phase === "redirecting";
  const allowed = canAllow(selected, info.scopes);
  const name = info.client_name.trim().slice(0, 80) || "An app";

  return (
    <div className="w-full max-w-[520px]">
      <div className="rounded-lg border border-border bg-surface-raised shadow-dialog">
        <div className="px-5 pb-5 pt-6 sm:px-7 sm:pt-7">
          <p className="text-12 font-medium text-fg-muted">Connect an app</p>
          <h1 className="mt-1.5 text-balance text-20 font-semibold leading-7 tracking-[-0.01em] text-fg sm:text-24 sm:leading-8">
            <span className="break-words" data-testid="client-name">{name}</span>{" "}
            <span className="font-normal text-fg-muted">
              wants to access your AheadOne account as{" "}
              <span className="break-words font-semibold text-fg" data-testid="user-name">{userName ?? "you"}</span>
            </span>
          </h1>
          {userEmail && <p className="mt-1.5 text-12 text-fg-muted">{userEmail}</p>}

          <div className="mt-5 flex items-start gap-3 rounded-md border border-border bg-surface-sunken px-3.5 py-3">
            <Globe className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden />
            <div className="min-w-0">
              <p className="text-12 text-fg-muted">After you choose, your browser returns to</p>
              <p className="mt-0.5 break-all font-mono text-14 font-semibold text-fg" data-testid="redirect-host">{host}</p>
            </div>
          </div>

          {info.unverified && (
            <div
              role="alert"
              className="mt-3 flex items-start gap-3 rounded-md bg-warning-subtle px-3.5 py-3 text-13 text-warning-text"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                <span className="font-semibold">Unverified app.</span> It registered itself, and nobody at your workspace has reviewed it.
                Continue only if you started this connection yourself, from a tool you trust.
              </p>
            </div>
          )}

          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy && allowed) onDecide(true, orderLike(selected, info.scopes));
            }}
          >
            <fieldset disabled={busy} className="flex flex-col gap-5">
              <legend className="sr-only">Permissions</legend>
              {(["read", "write"] as const).map((g) =>
                groups[g].length === 0 ? null : (
                  <div key={g}>
                    <h2 className="flex items-center gap-2 text-13 font-semibold text-fg">
                      {g === "read" ? "Read" : "Write"}
                      <span className="text-12 font-normal text-fg-muted">
                        {g === "read" ? "See your information" : "Make changes for you"}
                      </span>
                    </h2>
                    <ul className="mt-2 flex flex-col divide-y divide-border-subtle rounded-md border border-border">
                      {groups[g].map((s) => (
                        <li key={s.id} className="px-3 py-2.5">
                          <Checkbox
                            checked={selected.includes(s.id)}
                            onCheckedChange={() => setSelected((cur) => toggleScope(cur, s.id, info.scopes))}
                            label={<span className="text-13 font-medium text-fg">{s.description}</span>}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
              {info.scopes.length === 0 && (
                <p className="rounded-md bg-surface-sunken px-3 py-2.5 text-13 text-fg-muted">This app did not ask for any permission.</p>
              )}
            </fieldset>

            <div className="mt-5 rounded-md bg-surface-sunken px-3.5 py-3">
              <h2 className="flex items-center gap-2 text-13 font-semibold text-fg">
                <Ban className="size-4 text-fg-muted" aria-hidden /> This app can never
              </h2>
              <ul className="mt-1.5 grid gap-x-4 gap-y-1 text-13 text-fg-muted sm:grid-cols-2">
                {NEVER.map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span aria-hidden className="size-1 shrink-0 rounded-full bg-fg-faint" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-4 text-12 text-fg-muted">
              You can remove this app at any time in Settings, then Connected apps.
            </p>

            {phase === "error" && error && (
              <p role="alert" className="mt-3 rounded-sm bg-danger-subtle px-3 py-2 text-13 text-danger-text">
                {error}
              </p>
            )}

            <div className={cn("mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end")}>
              <p className="text-12 text-fg-muted sm:mr-auto" aria-live="polite">
                {phase === "redirecting" ? `Returning you to ${host}` : allowSummary(selected, info.scopes)}
              </p>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => onDecide(false, [])} className="max-sm:w-full">
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={busy} disabled={!allowed} className="max-sm:w-full">
                Allow
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/** Full-width states for a request that cannot be shown. */
export function ConsentProblem({
  kind,
  onRetry,
}: {
  kind: "expired" | "invalid" | "network" | "forbidden" | "unsafe";
  onRetry?: () => void;
}) {
  const copy = {
    expired: {
      icon: Clock,
      title: "This request has expired",
      body: "Connection requests are only valid for a few minutes. Go back to the app and start the connection again.",
    },
    invalid: {
      icon: Link2Off,
      title: "This link isn't valid",
      body: "It may have been used already or copied incorrectly. Go back to the app and start the connection again.",
    },
    forbidden: {
      icon: ShieldAlert,
      title: "You can't approve this request",
      body: "This request was started for a different account. Sign in with the account that started it, or begin again from the app.",
    },
    network: {
      icon: Link2Off,
      title: "Couldn't load the request",
      body: "Check your connection and try again.",
    },
    unsafe: {
      icon: ShieldAlert,
      title: "We stopped before leaving AheadOne",
      body: "The address this app asked us to return to doesn't match the one it registered, so we did not send you there. Close this tab. Nothing was shared.",
    },
  }[kind];
  const Icon = copy.icon;
  return (
    <div className="w-full max-w-[460px] rounded-lg border border-border bg-surface-raised px-6 py-10 text-center shadow-dialog">
      <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-surface-sunken text-fg-muted">
        <Icon className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 text-18 font-semibold text-fg">{copy.title}</h1>
      <p className="mx-auto mt-1.5 max-w-[38ch] text-13 text-fg-muted">{copy.body}</p>
      {kind === "network" && onRetry && (
        <Button className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function ConsentSkeleton() {
  return (
    <div className="w-full max-w-[520px] rounded-lg border border-border bg-surface-raised p-7 shadow-dialog" role="status" aria-label="Loading request">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-4/5" />
      <Skeleton className="mt-2 h-7 w-3/5" />
      <Skeleton className="mt-6 h-16" />
      <Skeleton className="mt-6 h-40" />
    </div>
  );
}

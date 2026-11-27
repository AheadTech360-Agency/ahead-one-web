"use client";

import { format } from "date-fns";
import { Check, Copy, ExternalLink, PlugZap, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/dialog";
import { EmptyState } from "@/ui/empty-state";
import { Skeleton } from "@/ui/skeleton";
import { toast } from "@/ui/toaster";
import type { OauthGrant } from "@/lib/api/types";
import { CLAUDE_CODE_SNIPPET, DOCS_URL, JSON_SNIPPET, MCP_URL, lastUsedLabel, scopeGroup, scopeLabel } from "./logic";

export function GrantsPanel({
  grants,
  loading,
  error,
  onRetry,
  showUser,
  canRevoke,
  onRevoke,
  emptyIsSetup = true,
}: {
  grants: OauthGrant[] | undefined;
  loading: boolean;
  /** Message for the inline error state (only when there is nothing cached to show). */
  error?: string;
  onRetry?: () => void;
  showUser: boolean;
  canRevoke: (g: OauthGrant) => boolean;
  onRevoke: (g: OauthGrant) => void;
  emptyIsSetup?: boolean;
}) {
  const [target, setTarget] = useState<OauthGrant | null>(null);

  if (loading) return <GrantsSkeleton />;
  if (error && grants === undefined) {
    return (
      <EmptyState
        tone="danger"
        icon={TriangleAlert}
        title="Connected apps didn't load"
        description={error}
        action={onRetry && <Button onClick={onRetry}>Try again</Button>}
      />
    );
  }
  if (!grants || grants.length === 0) {
    return emptyIsSetup ? (
      <SetupGuide empty />
    ) : (
      <EmptyState icon={PlugZap} title="Nobody has connected an app yet" description="When someone in the workspace allows an AI app, it appears here." />
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3" aria-label="Connected apps">
        {grants.map((g) => (
          <GrantRow key={g.id} grant={g} showUser={showUser} canRevoke={canRevoke(g)} onRevoke={() => setTarget(g)} />
        ))}
      </ul>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target ? `Revoke ${target.client_name}?` : "Revoke app"}
        description={
          target
            ? showUser && target.user
              ? `${target.client_name} will immediately lose access to ${target.user.full_name || target.user.email}'s account. They can connect it again.`
              : `${target.client_name} will immediately lose access to your account. You can connect it again later.`
            : ""
        }
        confirmLabel={target ? `Revoke ${target.client_name}` : "Revoke"}
        onConfirm={() => {
          if (target) onRevoke(target);
          setTarget(null);
        }}
      />
    </>
  );
}

function GrantRow({ grant: g, showUser, canRevoke, onRevoke }: { grant: OauthGrant; showUser: boolean; canRevoke: boolean; onRevoke: () => void }) {
  return (
    <li className="rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-14 font-semibold text-fg">{g.client_name}</h3>
          </div>
          {showUser && g.user && (
            <p className="mt-1 flex items-center gap-1.5 text-12 text-fg-muted">
              <Avatar user={g.user} size="xs" decorative />
              <span className="truncate">{g.user.full_name || g.user.email}</span>
            </p>
          )}
        </div>
        {canRevoke && (
          <Button variant="secondary" size="sm" onClick={onRevoke} aria-label={`Revoke ${g.client_name}`}>
            Revoke
          </Button>
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Permissions">
        {g.scopes.map((s) => (
          <li key={s}>
            <Badge tone={scopeGroup(s) === "write" ? "accent" : "neutral"}>{scopeLabel(s)}</Badge>
          </li>
        ))}
      </ul>
      <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-border-subtle pt-3 text-12">
        <Stat label="Connected" value={format(new Date(g.created_at), "MMM d, yyyy")} />
        <Stat label="Last used" value={lastUsedLabel(g.last_used_at)} />
        <Stat label="Calls this week" value={g.calls_this_week.toLocaleString()} tabular />
      </dl>
    </li>
  );
}

function Stat({ label, value, tabular }: { label: string; value: string; tabular?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-fg-muted">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-13 font-medium text-fg", tabular && "tabular")}>{value}</dd>
    </div>
  );
}

export function GrantsSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading connected apps">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-md border border-border bg-surface p-4">
          <Skeleton className="h-4 w-40" />
          <div className="mt-3 flex gap-1.5">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="mt-4 h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

/* ---------- Setup ---------- */

function CopyBox({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy", { description: "Your browser blocked clipboard access. Select the text and copy it." });
    }
  }
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h4 className="text-13 font-semibold text-fg">{label}</h4>
        <Button variant="ghost" size="sm" onClick={() => void copy()} aria-label={`Copy ${label} snippet`}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md border border-border bg-surface-sunken px-3 py-2.5 font-mono text-12 leading-5 text-fg" tabIndex={0}>
        <code>{text}</code>
      </pre>
    </div>
  );
}

/** What connected apps are and how to connect one. The empty state of the page, and a collapsible below a list. */
export function SetupGuide({ empty = false }: { empty?: boolean }) {
  const body = (
    <div className="flex flex-col gap-5">
      <CopyBox label="MCP server URL" text={MCP_URL} />
      <CopyBox label="Claude Code" text={CLAUDE_CODE_SNIPPET} />
      <CopyBox label="Claude Desktop and Cursor (JSON config)" text={JSON_SNIPPET} />
      <p className="text-13 text-fg-muted">
        Your app opens a page here asking you to allow it. You choose what it may read or change, and you can revoke it on this screen.{" "}
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-fg underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
        >
          Read the setup docs <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </p>
    </div>
  );
  if (!empty) {
    return (
      <details className="group mt-5 rounded-md border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-13 font-semibold text-fg focus-visible:outline-2 focus-visible:outline-ring">
          Connect another app
          <span aria-hidden className="text-fg-faint transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="border-t border-border-subtle p-4">{body}</div>
      </details>
    );
  }
  return (
    <section className="rounded-md border border-border bg-surface">
      <div className="border-b border-border-subtle px-5 py-5">
        <span className="flex size-9 items-center justify-center rounded-md bg-surface-sunken text-fg-muted">
          <PlugZap className="size-[18px]" aria-hidden />
        </span>
        <h2 className="mt-3 text-16 font-semibold text-fg">No apps connected yet</h2>
        <p className="mt-1 max-w-[62ch] text-13 text-fg-muted">
          Connected apps are AI tools, like Claude or Cursor, that you allow to work in AheadOne for you. They can read your messages, tasks and
          files, and write only when you let them. They never see other people&apos;s private tasks, and you can disconnect any app here at any time.
        </p>
      </div>
      <div className="p-5">{body}</div>
    </section>
  );
}

"use client";

import { HardDrive, History, ShieldAlert, ShieldCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import type { FilesSummary, OwnerExtras } from "@/lib/api/types";
import { auditActionLabel } from "@/lib/permissions/rules";
import { ROLE_LABEL } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { EmptyState } from "@/ui/empty-state";
import { ago, formatBytes, formatCount } from "../lib/logic";
import { Panel } from "./primitives";

const ROLE_FILL: Record<string, string> = {
  owner: "bg-navy-deep dark:bg-chart-1",
  admin: "bg-chart-1",
  management: "bg-chart-2",
  member: "bg-border-strong",
  guest: "bg-active",
};

const noopSub = () => () => {};

/** Owner-only: people, security and storage at a glance, then the latest audit events. */
export function OwnerBlock({ owner, files, className }: { owner: OwnerExtras; files: FilesSummary; className?: string }) {
  const total = owner.role_counts.reduce((n, r) => n + r.count, 0);
  const roles = useMemo(
    () => ["owner", "admin", "management", "member", "guest"].map((r) => owner.role_counts.find((x) => x.role === r)).filter((x): x is NonNullable<typeof x> => !!x && x.count > 0),
    [owner.role_counts],
  );
  const stamp = useSyncExternalStore(noopSub, () => Math.floor(Date.now() / 60_000), () => 0);
  const now = stamp ? new Date(stamp * 60_000) : null;
  const flagged = owner.members_without_two_factor;

  return (
    <div className={cn("grid gap-4 lg:grid-cols-12", className)}>
      <Panel title="People and security" className="lg:col-span-5" id="owner-people">
        <div className="flex flex-col gap-5 p-4">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-12 font-medium text-fg-muted">Members by role</p>
              <p className="text-12 tabular text-fg-muted">{total} in total</p>
            </div>
            {roles.length === 0 ? (
              <p className="text-13 text-fg-faint">No members.</p>
            ) : (
              <>
                <div className="flex h-2.5 gap-px overflow-hidden rounded-full" role="img" aria-label={roles.map((r) => `${r.count} ${ROLE_LABEL[r.role]}`).join(", ")}>
                  {roles.map((r) => (
                    <span key={r.role} className={cn("h-full", ROLE_FILL[r.role])} style={{ width: `${(r.count / Math.max(1, total)) * 100}%` }} />
                  ))}
                </div>
                <ul className="m-0 mt-3 grid list-none grid-cols-2 gap-x-4 gap-y-1.5 p-0 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                  {roles.map((r) => (
                    <li key={r.role} className="flex items-center gap-2 text-13 text-fg-muted">
                      <span aria-hidden className={cn("size-2 rounded-[2px]", ROLE_FILL[r.role])} />
                      {ROLE_LABEL[r.role]}
                      <span className="ml-auto font-medium tabular text-fg">{r.count}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <dl className="m-0 grid grid-cols-2 gap-3 border-t border-border-subtle pt-4">
            <div>
              <dt className="flex items-center gap-1.5 text-12 text-fg-muted">
                <UserPlus className="size-3.5" aria-hidden /> Joined in 30 days
              </dt>
              <dd className="figure m-0 text-[24px] font-medium leading-8 tracking-[-0.02em] tabular text-fg">{owner.joined_30d}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-12 text-fg-muted">
                <HardDrive className="size-3.5" aria-hidden /> Storage used
              </dt>
              <dd className="figure m-0 text-[24px] font-medium leading-8 tracking-[-0.02em] tabular text-fg">
                {formatBytes(owner.storage_bytes)}
                <span className="ml-1.5 text-12 font-normal tracking-normal text-fg-muted">{formatCount(files.count)} files</span>
              </dd>
            </div>
          </dl>

          <Link
            href="/settings/members"
            className={cn(
              "flex items-start gap-3 rounded-md border p-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              flagged > 0 ? "border-warning bg-warning-subtle hover:brightness-[0.98]" : "border-border bg-surface-sunken hover:bg-hover",
            )}
          >
            {flagged > 0 ? <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning-text" aria-hidden /> : <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-text" aria-hidden />}
            <span className="min-w-0">
              <span className={cn("block text-13 font-semibold", flagged > 0 ? "text-warning-text" : "text-fg")}>
                {flagged > 0 ? `${flagged} ${flagged === 1 ? "person has" : "people have"} no email-code sign-in` : "Everyone signs in with an email code"}
              </span>
              <span className="block text-12 text-fg-muted">
                {flagged > 0 ? "Owners and Admins must use it. Ask the others to turn it on in their account." : "Two-step sign-in is on for every active member."}
              </span>
            </span>
          </Link>
        </div>
      </Panel>

      <Panel title="Recent audit events" count={owner.recent_audit.length} aside={<Link href="/settings/audit-log" className="font-semibold text-fg underline decoration-2 underline-offset-4 hover:decoration-green">Open log</Link>} className="lg:col-span-7" id="owner-audit">
        {owner.recent_audit.length === 0 ? (
          <EmptyState compact icon={History} title="No audit events yet" description="Role changes, invites and removals are recorded here." />
        ) : (
          <ul className="m-0 list-none p-0">
            {owner.recent_audit.map((e) => (
              <li key={e.id} className="flex items-center gap-3 border-b border-border-subtle px-4 py-2.5 last:border-b-0">
                {e.actor ? <Avatar user={e.actor} size="sm" decorative /> : <span aria-hidden className="size-6 shrink-0 rounded-full border border-dashed border-border-strong" />}
                <p className="min-w-0 flex-1 text-13 text-fg-muted">
                  <span className="font-medium text-fg">{e.actor ? e.actor.full_name || e.actor.email : "Former member"}</span> {auditActionLabel(e.action).toLowerCase()}
                  <span className="text-fg-faint"> on {e.target}</span>
                </p>
                <time dateTime={e.created_at} className="shrink-0 text-12 tabular text-fg-faint">
                  {now ? ago(e.created_at, now) : ""}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

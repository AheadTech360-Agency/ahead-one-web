"use client";

import { CircleAlert, History, RotateCw } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { errorMessage } from "@/lib/api/client";
import { useAuditLog } from "@/lib/api/hooks";
import type { AuditEntry, JsonValue } from "@/lib/api/types";
import { auditActionLabel, isAccessAction } from "@/lib/permissions/rules";
import { ROLE_LABEL } from "@/lib/workspace";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { SkeletonRows } from "@/ui/skeleton";
import { format } from "date-fns";

const NO_FILTERS = {};

function roleOf(v: JsonValue | null): string | null {
  if (v && typeof v === "object" && !Array.isArray(v) && typeof v.role === "string") return ROLE_LABEL[v.role as keyof typeof ROLE_LABEL] ?? v.role;
  return null;
}

function detail(e: AuditEntry): string {
  if (e.action === "member.role_changed") {
    const from = roleOf(e.before);
    const to = roleOf(e.after);
    if (from && to) return `${from} to ${to}`;
  }
  return "";
}

/** Owner only: the latest role and client-access events, filtered from the audit log's first page. */
export function AccessAuditSection({ workspaceId }: { workspaceId: string }) {
  const log = useAuditLog(workspaceId, NO_FILTERS);
  const rows = useMemo(() => (log.data?.pages[0]?.items ?? []).filter((e) => isAccessAction(e.action)).slice(0, 8), [log.data]);
  return (
    <section aria-labelledby="access-audit-h" className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 id="access-audit-h" className="text-14 font-semibold">
          Role and access changes
        </h2>
        <Link href="/settings/audit-log" className="text-12 font-semibold text-fg underline decoration-2 underline-offset-4 hover:decoration-green">
          Open audit log
        </Link>
      </div>
      <div className="mt-2">
        {log.isPending ? (
          <SkeletonRows rows={3} columns={[30, 30, 14]} />
        ) : log.isError && log.data === undefined ? (
          <EmptyState
            compact
            tone="danger"
            icon={CircleAlert}
            title="Couldn't load the changes"
            description={errorMessage(log.error)}
            action={
              <Button size="sm" onClick={() => void log.refetch()}>
                <RotateCw aria-hidden /> Retry
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState compact icon={History} title="No role or access changes yet" description="Promotions, demotions, removals and client access edits are listed here." />
        ) : (
          <ul className="m-0 list-none rounded-md border border-border p-0">
            {rows.map((e) => (
              <li key={e.id} className="flex items-center gap-3 border-b border-border-subtle px-3 py-2.5 last:border-b-0">
                {e.actor ? <Avatar user={e.actor} size="sm" decorative /> : <span aria-hidden className="size-6 shrink-0 rounded-full border border-dashed border-border-strong" />}
                <p className="min-w-0 flex-1 text-13 text-fg-muted">
                  <span className="font-medium text-fg">{e.actor ? e.actor.full_name || e.actor.email : "System"}</span> {auditActionLabel(e.action).toLowerCase()}
                  {detail(e) && <span className="text-fg"> ({detail(e)})</span>}
                </p>
                <time dateTime={e.created_at} className="shrink-0 text-12 tabular text-fg-faint" title={format(new Date(e.created_at), "PPpp")}>
                  {format(new Date(e.created_at), "d MMM, HH:mm")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

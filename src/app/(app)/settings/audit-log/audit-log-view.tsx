"use client";

import { format } from "date-fns";
import { CircleAlert, FileClock, RotateCw, Search, ShieldAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page";
import { errorMessage, isApiError } from "@/lib/api/client";
import { useAuditLog, useMembers } from "@/lib/api/hooks";
import type { AuditEntry, JsonValue } from "@/lib/api/types";
import { useWorkspace } from "@/lib/workspace";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { Input } from "@/ui/input";
import { Select } from "@/ui/select";
import { Sheet, SheetContent } from "@/ui/sheet";
import { SkeletonRows } from "@/ui/skeleton";

const ANY = "__any";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** "member.role_changed" -> "Member role changed" */
function humanize(action: string) {
  const s = action.replace(/[._]/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function AuditLogView() {
  const { workspaceId, meError, refetchMe } = useWorkspace();
  const members = useMembers(workspaceId);
  const [actionInput, setActionInput] = useState("");
  const [actor, setActor] = useState<string>(ANY);
  const action = useDebounced(actionInput.trim(), 300);
  const filters = { action: action || undefined, actor: actor === ANY ? undefined : actor };
  const log = useAuditLog(workspaceId, filters);
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const rows = log.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = Boolean(filters.action || filters.actor);
  const forbidden = isApiError(log.error) && log.error.status === 403;

  return (
    <>
      <PageHeader title="Audit log" description="Security-relevant changes in this workspace, newest first." />

      <div className="mt-5 flex flex-wrap items-center gap-2" role="search" aria-label="Filter audit log">
        <Input
          aria-label="Filter by action"
          leading={<Search />}
          value={actionInput}
          onChange={(e) => setActionInput(e.target.value)}
          placeholder="Action, e.g. invite.created"
          className="w-full sm:w-64"
        />
        <Select
          aria-label="Filter by person"
          value={actor}
          onValueChange={setActor}
          className="w-full sm:w-56"
          options={[
            { value: ANY, label: "Anyone" },
            ...(members.data ?? []).map((m) => ({ value: m.user.id, label: m.user.full_name || m.user.email })),
          ]}
        />
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setActionInput("");
              setActor(ANY);
            }}
          >
            <X aria-hidden /> Clear filters
          </Button>
        )}
      </div>

      <div className="mt-4">
        {log.isPending && workspaceId ? (
          <SkeletonRows rows={10} columns={[18, 30, 22, 14]} />
        ) : forbidden ? (
          <EmptyState icon={ShieldAlert} title="Only admins can view the audit log" description="Ask a workspace owner or admin for access." />
        ) : log.isError || !workspaceId ? (
          <EmptyState
            tone="danger"
            icon={CircleAlert}
            title="Couldn't load the audit log"
            description={errorMessage(workspaceId ? log.error : meError)}
            action={
              (
                <Button size="sm" onClick={() => (workspaceId ? void log.refetch() : refetchMe())}>
                  <RotateCw aria-hidden /> Retry
                </Button>
              )
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={FileClock}
            title={filtered ? "No entries match these filters" : "No activity recorded yet"}
            description={
              filtered
                ? "Try a broader action name or a different person."
                : "Role changes, invites and removals are recorded here."
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-13">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="h-9 w-44 px-3 text-left text-12 font-normal text-fg-muted">When</th>
                    <th scope="col" className="h-9 px-3 text-left text-12 font-normal text-fg-muted">Who</th>
                    <th scope="col" className="h-9 px-3 text-left text-12 font-normal text-fg-muted">Action</th>
                    <th scope="col" className="h-9 px-3 text-left text-12 font-normal text-fg-muted">Target</th>
                    <th scope="col" className="h-9 w-32 px-3 text-right text-12 font-normal text-fg-muted">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr
                      key={e.id}
                      className="cursor-pointer border-b border-border-subtle hover:bg-surface-sunken"
                      onClick={() => setSelected(e)}
                    >
                      <td className="h-11 px-3 text-fg-muted tabular">
                        <time dateTime={e.created_at}>{format(new Date(e.created_at), "yyyy-MM-dd HH:mm")}</time>
                      </td>
                      <td className="px-3">
                        {e.actor ? (
                          <span className="flex items-center gap-2">
                            <Avatar user={e.actor} size="xs" decorative />
                            <span className="truncate">{e.actor.full_name || e.actor.email}</span>
                          </span>
                        ) : (
                          <span className="text-fg-muted">System</span>
                        )}
                      </td>
                      <td className="px-3">
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setSelected(e);
                          }}
                          className="rounded-xs text-left font-medium text-fg hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          {humanize(e.action)}
                        </button>
                      </td>
                      <td className="px-3 text-fg-muted">
                        {e.target_type}
                        {e.target_id && <span className="ml-1 font-mono text-12">{e.target_id.slice(0, 8)}</span>}
                      </td>
                      <td className="px-3 text-right font-mono text-12 text-fg-muted">{e.ip ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between py-3 text-12 text-fg-muted">
              <span className="tabular">{rows.length} entries shown</span>
              {log.hasNextPage && (
                <Button size="sm" loading={log.isFetchingNextPage} onClick={() => log.fetchNextPage()}>
                  Load older entries
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent
          title={selected ? humanize(selected.action) : "Entry"}
          description={selected ? format(new Date(selected.created_at), "PPpp") : undefined}
        >
          {selected && <EntryDetail entry={selected} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function EntryDetail({ entry }: { entry: AuditEntry }) {
  const rows: [string, React.ReactNode][] = [
    ["Who", entry.actor ? `${entry.actor.full_name || entry.actor.email} (${entry.actor.email})` : "System"],
    ["Action", <code key="a" className="font-mono text-12">{entry.action}</code>],
    ["Target", `${entry.target_type}${entry.target_id ? ` ${entry.target_id}` : ""}`],
    ["IP address", entry.ip ?? "-"],
  ];
  return (
    <div className="flex flex-col gap-5 p-4">
      <dl className="flex flex-col">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[96px_1fr] gap-3 border-b border-border-subtle py-2 text-13">
            <dt className="text-fg-muted">{k}</dt>
            <dd className="min-w-0 break-words text-fg">{v}</dd>
          </div>
        ))}
      </dl>
      <JsonBlock label="Before" value={entry.before} />
      <JsonBlock label="After" value={entry.after} />
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: JsonValue | null }) {
  return (
    <section>
      <h3 className="pb-1.5 text-12 font-medium text-fg-muted">{label}</h3>
      {value === null ? (
        <p className="text-13 text-fg-faint">No data</p>
      ) : (
        <pre className="max-h-64 overflow-auto rounded-sm bg-surface-sunken p-3 font-mono text-12 leading-5 text-fg">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </section>
  );
}

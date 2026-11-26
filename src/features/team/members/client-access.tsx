"use client";

import { Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import { useTree } from "@/lib/api/hooks";
import type { Member } from "@/lib/api/types";
import { clientAccessChangeCopy, clientAccessLabel, joinPhrases, type ClientAccess } from "@/lib/permissions/rules";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/ui/dialog";
import { Skeleton } from "@/ui/skeleton";
import { toast } from "@/ui/toaster";
import { useMemberClients, useSetMemberClients } from "../api";
import { ClientDot } from "../components/primitives";

/**
 * "Client access" of one Admin, in the member list. Only the Owner sees the value and can edit it;
 * the API enforces the same. The value is cached for the session (never persisted).
 */
export function ClientAccessCell({ member, workspaceId }: { member: Member; workspaceId: string }) {
  const q = useMemberClients(workspaceId, member.user.id, true);
  const [open, setOpen] = useState(false);
  const name = member.user.full_name || member.user.email;
  if (q.isPending) return <Skeleton className="h-4 w-24" />;
  if (!q.data) {
    return (
      <button type="button" onClick={() => void q.refetch()} className="text-12 text-danger-text underline underline-offset-2">
        Couldn&apos;t load. Retry
      </button>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Client access for ${name}: ${clientAccessLabel(q.data)}. Edit`}
        className="group inline-flex items-center gap-1.5 rounded-sm px-1.5 py-1 text-13 text-fg outline-none hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className={cn(q.data.all_clients ? "text-fg" : "font-medium text-warning-text")}>{clientAccessLabel(q.data)}</span>
        <Pencil className="size-3 text-fg-faint group-hover:text-fg" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        {open && <ClientAccessDialog key={String(open)} member={member} current={q.data} workspaceId={workspaceId} onClose={() => setOpen(false)} />}
      </Dialog>
    </>
  );
}

function ClientAccessDialog({ member, current, workspaceId, onClose }: { member: Member; current: ClientAccess; workspaceId: string; onClose: () => void }) {
  const tree = useTree(workspaceId);
  const save = useSetMemberClients(workspaceId);
  const name = member.user.full_name || member.user.email;
  const spaces = useMemo(() => (tree.data ?? []).filter((s) => !s.archived), [tree.data]);
  const [all, setAll] = useState(current.all_clients);
  const [picked, setPicked] = useState<string[]>(current.space_ids);
  const byId = useMemo(() => new Map(spaces.map((s) => [s.id, s.name])), [spaces]);
  const next: ClientAccess = { all_clients: all, space_ids: all ? [] : picked };
  const copy = clientAccessChangeCopy(name, current, next, (id) => byId.get(id) ?? "a client", spaces.map((s) => s.id));

  function submit() {
    onClose();
    save.mutate(
      { userId: member.user.id, body: next },
      {
        onSuccess: () => toast.success(`Client access updated for ${name}`, { description: clientAccessLabel(next) }),
        onError: (e) => toast.error("Couldn't change client access", { description: errorMessage(e) }),
      },
    );
  }

  return (
    <DialogContent title={`Client access for ${name}`} description="Clients are spaces. An Admin only sees the clients you allow, on the dashboard, in the sidebar and in search." size="md">
      <DialogBody>
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
          <div>
            <p className="text-13 font-medium text-fg">All clients</p>
            <p className="text-12 text-fg-muted">Every client, including new ones.</p>
          </div>
          <label className="sr-only" htmlFor="all-clients">
            All clients
          </label>
          <SwitchLike id="all-clients" checked={all} onChange={setAll} />
        </div>

        {!all && (
          <fieldset className="mt-3">
            <legend className="mb-1.5 text-12 font-medium text-fg-muted">Choose clients ({picked.length} selected)</legend>
            {tree.isPending ? (
              <div className="flex flex-col gap-2" role="status" aria-label="Loading clients">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : spaces.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-3 text-13 text-fg-muted">There are no clients yet. Create a space from the sidebar first.</p>
            ) : (
              <ul className="m-0 max-h-[240px] list-none overflow-y-auto rounded-md border border-border p-1">
                {spaces.map((s) => (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 hover:bg-hover">
                      <Checkbox
                        checked={picked.includes(s.id)}
                        onCheckedChange={(v) => setPicked((p) => (v === true ? [...p, s.id] : p.filter((x) => x !== s.id)))}
                        aria-label={s.name}
                      />
                      <ClientDot color={s.color} />
                      <span className="min-w-0 flex-1 truncate text-13 text-fg">{s.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        )}

        <div aria-live="polite" className={cn("mt-4 rounded-md p-3 text-13", copy.loses.length ? "bg-warning-subtle" : "bg-surface-sunken")}>
          {copy.noChange ? (
            <p className="text-fg-muted">No change yet.</p>
          ) : (
            <>
              {copy.lines.map((l) => (
                <p key={l} className="text-fg">
                  {l}
                </p>
              ))}
              {copy.loses.length > 0 && (
                <p className="mt-1 text-warning-text">
                  <b className="font-semibold">Loses access to:</b> {joinPhrases(copy.loses)}. Their tasks and comments there stay.
                </p>
              )}
            </>
          )}
        </div>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <Button variant={copy.loses.length ? "danger" : "primary"} disabled={copy.noChange} onClick={submit}>
          {copy.loses.length ? "Save and remove access" : "Save access"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function SwitchLike({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border border-transparent bg-border-strong p-0.5 transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-checked:bg-accent"
    >
      <span className={cn("block size-3.5 rounded-full bg-white shadow-xs transition-transform", checked && "translate-x-3.5")} />
    </button>
  );
}

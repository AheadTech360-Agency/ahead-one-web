"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { errorMessage, isApiError } from "@/lib/api/client";
import { useUpdateMemberRole } from "@/lib/api/hooks";
import type { Member } from "@/lib/api/types";
import { assignableRoles, joinPhrases, ROLE_NAME, ROLE_SUMMARY, roleChangeCopy, roleErrorMessage, type Role } from "@/lib/permissions/rules";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/ui/dialog";
import { toast } from "@/ui/toaster";

/**
 * Change one person's role: pick from the roles the actor may grant, read in plain words what the
 * person gains and loses, then confirm. The list updates at once (see useUpdateMemberRole) and
 * rolls back with a friendly message if the API refuses (last Owner, Admin-only changes).
 */
export function RoleDialog({
  member,
  actorRole,
  workspaceId,
  onClose,
}: {
  member: Member | null;
  actorRole: Role | undefined;
  workspaceId: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(member)} onOpenChange={(o) => !o && onClose()}>
      {member && <RoleDialogBody key={member.user.id} member={member} actorRole={actorRole} workspaceId={workspaceId} onClose={onClose} />}
    </Dialog>
  );
}

function RoleDialogBody({ member, actorRole, workspaceId, onClose }: { member: Member; actorRole: Role | undefined; workspaceId: string; onClose: () => void }) {
  const update = useUpdateMemberRole(workspaceId);
  const roles = assignableRoles(actorRole);
  const name = member.user.full_name || member.user.email;
  const [next, setNext] = useState<Role>(member.role);
  const copy = next !== member.role ? roleChangeCopy(name, member.role, next) : null;

  function save() {
    if (!copy) return;
    const to = next;
    onClose();
    update.mutate(
      { userId: member.user.id, role: to },
      {
        onSuccess: () => toast.success(`${name} is now ${/^[aeiou]/i.test(ROLE_NAME[to]) ? "an" : "a"} ${ROLE_NAME[to]}`),
        onError: (e) =>
          toast.error("Couldn't change the role", {
            description: roleErrorMessage(isApiError(e) ? e.status : undefined, isApiError(e) ? e.message : errorMessage(e)),
          }),
      },
    );
  }

  return (
    <DialogContent title={`Change role for ${name}`} description={`Currently ${ROLE_NAME[member.role]}. Pick the new role and check what changes.`} size="md">
      <DialogBody>
        <div role="radiogroup" aria-label="Role" className="flex flex-col gap-1.5">
          {roles.map((r) => {
            const on = next === r;
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setNext(r)}
                className={cn(
                  "flex items-start gap-3 rounded-md border px-3 py-2.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  on ? "border-accent bg-accent-subtle" : "border-border hover:bg-hover",
                )}
              >
                <span aria-hidden className={cn("mt-1 inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border", on ? "border-accent" : "border-border-strong")}>
                  {on && <span className="size-1.5 rounded-full bg-accent" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-13 font-medium text-fg">
                    {ROLE_NAME[r]}
                    {r === member.role && <span className="ml-1.5 font-normal text-fg-muted">(current)</span>}
                  </span>
                  <span className="block text-12 text-fg-muted">{ROLE_SUMMARY[r]}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div aria-live="polite" className="mt-4 min-h-[72px] rounded-md bg-surface-sunken p-3 text-13">
          {copy ? (
            <>
              <p className="font-medium text-fg">{copy.headline}</p>
              {copy.gains.length > 0 && (
                <p className="mt-1.5 flex items-start gap-2 text-fg-muted">
                  <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-success-text" aria-hidden />
                  <span>
                    <b className="font-medium text-fg">Gains:</b> can {joinPhrases(copy.gains)}.
                  </span>
                </p>
              )}
              {copy.loses.length > 0 && (
                <p className="mt-1.5 flex items-start gap-2 text-fg-muted">
                  <ArrowDownRight className="mt-0.5 size-4 shrink-0 text-warning-text" aria-hidden />
                  <span>
                    <b className="font-medium text-fg">Loses:</b> can no longer {joinPhrases(copy.loses)}.
                  </span>
                </p>
              )}
              {copy.gains.length === 0 && copy.loses.length === 0 && <p className="mt-1.5 text-fg-muted">Their permissions stay the same.</p>}
            </>
          ) : (
            <p className="text-fg-muted">Choose a different role to see what changes.</p>
          )}
        </div>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <Button variant={copy?.isDowngrade ? "danger" : "primary"} disabled={!copy} onClick={save}>
          {copy ? copy.confirmLabel : "Change role"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

"use client";

import { format, formatDistanceToNowStrict, isPast } from "date-fns";
import { CircleAlert, Mail, MoreHorizontal, RotateCw, Send, ShieldAlert, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/page";
import { errorMessage, isApiError } from "@/lib/api/client";
import {
  useCreateInvite,
  useInvites,
  useMembers,
  useRemoveMember,
  useResendInvite,
  useRevokeInvite,
  useUpdateMemberRole,
} from "@/lib/api/hooks";
import type { Invite, Member, Role } from "@/lib/api/types";
import { ROLE_DESCRIPTION, ROLE_LABEL, ROLES, roleAtLeast, useWorkspace } from "@/lib/workspace";
import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { ConfirmDialog, Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/ui/dialog";
import { EmptyState } from "@/ui/empty-state";
import { Field } from "@/ui/field";
import { Input } from "@/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/ui/menu";
import { Select } from "@/ui/select";
import { SkeletonRows } from "@/ui/skeleton";
import { toast } from "@/ui/toaster";

/** Roles an actor may grant: only owners may grant owner or admin. */
function grantable(actor: Role | undefined): Role[] {
  if (actor === "owner") return ROLES;
  if (actor === "admin") return ["management", "member", "guest"];
  return [];
}

export function MembersView() {
  const { workspaceId, role, me, meError, refetchMe } = useWorkspace();
  const members = useMembers(workspaceId);
  const isAdmin = roleAtLeast(role, "admin");
  const invites = useInvites(workspaceId, isAdmin);
  const [inviteOpen, setInviteOpen] = useState(false);

  const forbidden = isApiError(members.error) && members.error.status === 403;

  return (
    <>
      <PageHeader
        title="Members"
        description={
          members.data
            ? `${members.data.length} ${members.data.length === 1 ? "person" : "people"} in this workspace`
            : "People in this workspace and their roles"
        }
        actions={
          isAdmin && (
            <Button variant="primary" onClick={() => setInviteOpen(true)}>
              <UserPlus aria-hidden /> Invite people
            </Button>
          )
        }
      />

      <section aria-labelledby="members-h" className="mt-6">
        <h2 id="members-h" className="sr-only">
          Current members
        </h2>
        {members.isPending && workspaceId ? (
          <SkeletonRows rows={6} columns={[40, 15, 15]} />
        ) : forbidden ? (
          <EmptyState
            icon={ShieldAlert}
            title="Only admins can see this list"
            description="Ask a workspace owner or admin if you need someone added."
          />
        ) : (members.isError && members.data === undefined) || !workspaceId || !members.data ? (
          <LoadError
            what="members"
            error={workspaceId ? members.error : meError}
            onRetry={() => (workspaceId ? void members.refetch() : refetchMe())}
          />
        ) : members.data.length === 0 ? (
          <EmptyState icon={Users} title="No members yet" description="Invite your team to start sharing projects." />
        ) : (
          <MembersTable members={members.data} actorRole={role} meId={me?.user.id} workspaceId={workspaceId} />
        )}
      </section>

      {isAdmin && (
        <section aria-labelledby="invites-h" className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 id="invites-h" className="text-14 font-semibold">
              Pending invites
            </h2>
            {invites.data && (
              <span className="text-12 text-fg-muted tabular">
                {pendingOf(invites.data).length} pending
              </span>
            )}
          </div>
          <div className="mt-2">
            {invites.isPending ? (
              <SkeletonRows rows={3} columns={[36, 14, 20]} />
            ) : (invites.isError && invites.data === undefined) ? (
              <LoadError what="invites" error={invites.error} onRetry={() => invites.refetch()} />
            ) : pendingOf(invites.data).length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-4 py-3 text-13 text-fg-muted">
                No pending invites. People you invite show here until they accept.
              </p>
            ) : (
              <InvitesTable invites={pendingOf(invites.data)} workspaceId={workspaceId!} />
            )}
          </div>
        </section>
      )}

      {workspaceId && (
        <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} workspaceId={workspaceId} actorRole={role} />
      )}
    </>
  );
}

function pendingOf(invites: Invite[]) {
  return invites.filter((i) => !i.accepted_at && !i.revoked_at);
}

function LoadError({ what, error, onRetry }: { what: string; error: unknown; onRetry: () => void }) {
  return (
    <EmptyState
      compact
      tone="danger"
      icon={CircleAlert}
      title={`Couldn't load ${what}`}
      description={errorMessage(error)}
      action={
        <Button size="sm" onClick={onRetry}>
          <RotateCw aria-hidden /> Retry
        </Button>
      }
    />
  );
}

const th = "h-9 px-3 text-left text-12 font-normal text-fg-muted";
const td = "h-12 px-3";

function MembersTable({
  members,
  actorRole,
  meId,
  workspaceId,
}: {
  members: Member[];
  actorRole: Role | undefined;
  meId?: string;
  workspaceId: string;
}) {
  const updateRole = useUpdateMemberRole(workspaceId);
  const remove = useRemoveMember(workspaceId);
  const [removing, setRemoving] = useState<Member | null>(null);
  const roles = grantable(actorRole);

  function canManage(m: Member) {
    if (m.user.id === meId) return false;
    if (actorRole === "owner") return true;
    return actorRole === "admin" && !roleAtLeast(m.role, "admin");
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-13">
        <thead className="sticky top-0 z-[var(--z-sticky)] bg-surface">
          <tr className="border-b border-border">
            <th scope="col" className={th}>Name</th>
            <th scope="col" className={th}>Role</th>
            <th scope="col" className={`${th} text-right`}>Joined</th>
            <th scope="col" className="w-12"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.user.id} className="border-b border-border-subtle hover:bg-surface-sunken">
              <td className={td}>
                <div className="flex items-center gap-2.5">
                  <Avatar user={m.user} size="md" decorative className="size-7" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">
                      {m.user.full_name || m.user.email}
                      {m.user.id === meId && <span className="ml-1.5 font-normal text-fg-muted">(you)</span>}
                    </p>
                    <p className="truncate text-12 text-fg-muted">{m.user.email}</p>
                  </div>
                </div>
              </td>
              <td className={td}>
                <Badge tone={m.role === "owner" || m.role === "admin" ? "accent" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
              </td>
              <td className={`${td} text-right text-fg-muted tabular`}>
                <time dateTime={m.joined_at} title={format(new Date(m.joined_at), "PPpp")}>
                  {format(new Date(m.joined_at), "yyyy-MM-dd")}
                </time>
              </td>
              <td className="px-2 text-right">
                {canManage(m) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Actions for ${m.user.full_name || m.user.email}`}
                      className="inline-flex size-7 items-center justify-center rounded-sm text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-active"
                    >
                      <MoreHorizontal className="size-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Change role</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-64">
                          <DropdownMenuLabel>Role for {m.user.full_name || m.user.email}</DropdownMenuLabel>
                          <DropdownMenuRadioGroup
                            value={m.role}
                            onValueChange={(v) =>
                              updateRole.mutate(
                                { userId: m.user.id, role: v as Role },
                                {
                                  onSuccess: () => toast.success(`${m.user.full_name || m.user.email} is now ${ROLE_LABEL[v as Role]}`),
                                  onError: (e) => toast.error("Couldn't change the role", { description: errorMessage(e) }),
                                },
                              )
                            }
                          >
                            {roles.map((r) => (
                              <DropdownMenuRadioItem key={r} value={r} className="h-auto py-1.5">
                                <span className="flex flex-col">
                                  <span>{ROLE_LABEL[r]}</span>
                                  <span className="text-12 text-fg-muted">{ROLE_DESCRIPTION[r]}</span>
                                </span>
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem danger onSelect={() => setRemoving(m)}>
                        <UserMinus aria-hidden /> Remove from workspace
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.user.full_name || removing?.user.email || "member"}?`}
        description="They lose access to every project in this workspace right away. Their tasks and comments stay."
        confirmLabel="Remove member"
        loading={remove.isPending}
        onConfirm={() => {
          if (!removing) return;
          const who = removing.user.full_name || removing.user.email;
          remove.mutate(removing.user.id, {
            onSuccess: () => {
              toast.success(`Removed ${who}`);
              setRemoving(null);
            },
            onError: (e) => toast.error(`Couldn't remove ${who}`, { description: errorMessage(e) }),
          });
        }}
      />
    </div>
  );
}

function InvitesTable({ invites, workspaceId }: { invites: Invite[]; workspaceId: string }) {
  const resend = useResendInvite(workspaceId);
  const revoke = useRevokeInvite(workspaceId);
  const [revoking, setRevoking] = useState<Invite | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-13">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={th}>Email</th>
            <th scope="col" className={th}>Role</th>
            <th scope="col" className={th}>Invited by</th>
            <th scope="col" className={`${th} text-right`}>Expires</th>
            <th scope="col" className="w-36"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {invites.map((inv) => {
            const expired = isPast(new Date(inv.expires_at));
            return (
              <tr key={inv.id} className="border-b border-border-subtle">
                <td className={td}>
                  <span className="flex items-center gap-2">
                    <Mail className="size-4 shrink-0 text-fg-faint" aria-hidden />
                    <span className="truncate">{inv.email}</span>
                  </span>
                </td>
                <td className={td}>
                  <Badge>{ROLE_LABEL[inv.role]}</Badge>
                </td>
                <td className={`${td} text-fg-muted`}>{inv.invited_by?.full_name || inv.invited_by?.email || "-"}</td>
                <td className={`${td} text-right tabular`}>
                  {expired ? (
                    <Badge tone="warning">Expired</Badge>
                  ) : (
                    <time dateTime={inv.expires_at} className="text-fg-muted">
                      in {formatDistanceToNowStrict(new Date(inv.expires_at))}
                    </time>
                  )}
                </td>
                <td className="px-2">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={resend.isPending && resend.variables === inv.id}
                      onClick={() =>
                        resend.mutate(inv.id, {
                          onSuccess: () => toast.success(`Invite sent again to ${inv.email}`),
                          onError: (e) => toast.error("Couldn't resend the invite", { description: errorMessage(e) }),
                        })
                      }
                    >
                      <Send aria-hidden /> Resend
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Revoke invite for ${inv.email}`} onClick={() => setRevoking(inv)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ConfirmDialog
        open={Boolean(revoking)}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`Revoke the invite for ${revoking?.email ?? ""}?`}
        description="The invite link stops working. You can invite them again later."
        confirmLabel="Revoke invite"
        loading={revoke.isPending}
        onConfirm={() => {
          if (!revoking) return;
          const email = revoking.email;
          revoke.mutate(revoking.id, {
            onSuccess: () => {
              toast.success(`Revoked the invite for ${email}`);
              setRevoking(null);
            },
            onError: (e) => toast.error("Couldn't revoke the invite", { description: errorMessage(e) }),
          });
        }}
      />
    </div>
  );
}

const emailSchema = z.email("Enter a valid email address, like name@company.com.");

function InviteDialog({
  open,
  onOpenChange,
  workspaceId,
  actorRole,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workspaceId: string;
  actorRole: Role | undefined;
}) {
  const create = useCreateInvite(workspaceId);
  const roles = grantable(actorRole);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState<string | undefined>();

  function reset() {
    setEmail("");
    setRole("member");
    setError(undefined);
  }

  function validate(value: string) {
    const r = emailSchema.safeParse(value.trim());
    return r.success ? undefined : r.error.issues[0]?.message;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate(email);
    setError(err);
    if (err) return;
    create.mutate(
      { email: email.trim().toLowerCase(), role },
      {
        onSuccess: (inv) => {
          toast.success(`Invite sent to ${inv.email}`);
          reset();
          onOpenChange(false);
        },
        onError: (e2) =>
          setError(
            isApiError(e2) && e2.code === "conflict"
              ? "This person is already a member or has a pending invite."
              : errorMessage(e2),
          ),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent title="Invite to workspace" description="They get an email with a link to join this workspace.">
        <form onSubmit={submit} noValidate>
          <DialogBody className="flex flex-col gap-4">
            <Field label="Email" error={error}>
              <Input
                type="email"
                autoFocus
                autoComplete="off"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(undefined);
                }}
                onBlur={() => email && setError(validate(email))}
                placeholder="name@aheadtech360.com"
              />
            </Field>
            <Field
              label="Role"
              hint={actorRole !== "owner" ? "Only owners can invite owners and admins." : undefined}
            >
              <Select
                value={role}
                onValueChange={(v) => setRole(v as Role)}
                options={ROLES.map((r) => ({
                  value: r,
                  label: ROLE_LABEL[r],
                  description: ROLE_DESCRIPTION[r],
                  disabled: !roles.includes(r),
                }))}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={create.isPending}>
              <Send aria-hidden /> Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

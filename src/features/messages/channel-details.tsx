"use client";

import { Hash, Lock, LogOut, Pencil, UserMinus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/lib/api/client";
import { useMembers } from "@/lib/api/hooks";
import type { Conversation } from "@/lib/api/types";
import { roleAtLeast, useWorkspace } from "@/lib/workspace";
import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/dialog";
import { Field } from "@/ui/field";
import { IconButton } from "@/ui/icon-button";
import { Input, Textarea } from "@/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { Sheet, SheetContent } from "@/ui/sheet";
import { Skeleton } from "@/ui/skeleton";
import { toast } from "@/ui/toaster";
import {
  useAddChannelMember,
  useChannelMembers,
  useLeaveChannel,
  useRemoveChannelMember,
  useUpdateChannel,
} from "./api";
import { CHANNEL_NAME, displayName, normalizeChannelName } from "./format";
import { PersonList } from "./person-picker";

export function canAdminChannel(c: Conversation, meId: string | undefined, role: Parameters<typeof roleAtLeast>[0]) {
  return c.created_by === meId || roleAtLeast(role, "admin");
}

function AboutForm({ c, onDone }: { c: Conversation; onDone: () => void }) {
  const update = useUpdateChannel(c.id);
  const [name, setName] = useState(c.name ?? "");
  const [topic, setTopic] = useState(c.topic ?? "");
  const [nameError, setNameError] = useState<string | null>(null);

  function validate(v: string) {
    const n = normalizeChannelName(v);
    if (!n) return "Give the channel a name.";
    if (!CHANNEL_NAME.test(n)) return "Use lowercase letters, numbers, - and _ (up to 80).";
    return null;
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const err = validate(name);
        setNameError(err);
        if (err) return;
        update.mutate(
          { name: normalizeChannelName(name), topic: topic.trim() },
          {
            onSuccess: () => {
              toast.success("Channel updated");
              onDone();
            },
            onError: (e) => toast.error("Couldn't update the channel", { description: errorMessage(e) }),
          },
        );
      }}
    >
      <Field label="Name" error={nameError} hint={name && normalizeChannelName(name) !== name ? `Saved as #${normalizeChannelName(name)}` : undefined}>
        <Input
          value={name}
          autoFocus
          maxLength={81}
          leading={<Hash />}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(validate(e.target.value));
          }}
          onBlur={() => setNameError(validate(name))}
        />
      </Field>
      <Field label="Topic" optional hint="Shown under the channel name.">
        <Textarea value={topic} maxLength={250} rows={2} onChange={(e) => setTopic(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={update.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

/** Right-hand panel for a channel: about, members (add/remove when allowed), leave. */
export function ChannelDetails({
  c,
  open,
  onOpenChange,
}: {
  c: Conversation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { me, role, workspaceId } = useWorkspace();
  const meId = me?.user.id;
  const members = useChannelMembers(c.id, open);
  const everyone = useMembers(open ? workspaceId : undefined);
  const add = useAddChannelMember(c.id);
  const remove = useRemoveChannelMember(c.id);
  const leave = useLeaveChannel();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);

  const isAdmin = canAdminChannel(c, meId, role);
  const canAdd = c.is_member && (!c.is_private || isAdmin);
  const memberIds = new Set((members.data ?? []).map((u) => u.id));
  const addable = (everyone.data ?? []).map((m) => m.user).filter((u) => !memberIds.has(u.id));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={`#${c.name}`} description={c.is_private ? "Private channel" : "Public channel"}>
        <section className="border-b border-border-subtle px-4 py-4" aria-labelledby="about-h">
          <div className="mb-2 flex items-center justify-between">
            <h3 id="about-h" className="text-13 font-semibold text-fg">
              About
            </h3>
            {isAdmin && !editing && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil aria-hidden /> Edit
              </Button>
            )}
          </div>
          {editing ? (
            <AboutForm c={c} onDone={() => setEditing(false)} />
          ) : (
            <dl className="flex flex-col gap-3 text-13">
              <div>
                <dt className="text-12 text-fg-muted">Topic</dt>
                <dd className="mt-0.5 text-fg">{c.topic || <span className="text-fg-faint">No topic yet</span>}</dd>
              </div>
              <div>
                <dt className="text-12 text-fg-muted">Visibility</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-fg">
                  {c.is_private ? <Lock className="size-3.5 text-fg-faint" aria-hidden /> : <Hash className="size-3.5 text-fg-faint" aria-hidden />}
                  {c.is_private ? "Private: only invited members can find it" : "Public: anyone in the workspace can join"}
                </dd>
              </div>
            </dl>
          )}
        </section>

        <section className="px-4 py-4" aria-labelledby="members-h">
          <div className="mb-2 flex items-center justify-between">
            <h3 id="members-h" className="text-13 font-semibold text-fg">
              Members <span className="font-normal text-fg-muted tabular">{members.data?.length ?? c.member_count}</span>
            </h3>
            {canAdd && (
              <Popover open={adding} onOpenChange={setAdding}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="secondary">
                    <UserPlus aria-hidden /> Add people
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <PersonList
                    label="Add people to the channel"
                    people={addable}
                    empty={everyone.isPending ? "Loading people" : "Everyone is already here."}
                    busyId={add.isPending ? add.variables?.id : null}
                    onPick={(u) =>
                      add.mutate(u, {
                        onSuccess: () => toast.success(`Added ${displayName(u)} to #${c.name}`),
                        onError: (e) => toast.error(`Couldn't add ${displayName(u)}`, { description: errorMessage(e) }),
                      })
                    }
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
          {members.isPending ? (
            <div className="flex flex-col gap-3 py-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
          ) : (members.isError && members.data === undefined) ? (
            <p className="text-13 text-fg-muted">
              Couldn&apos;t load members. {errorMessage(members.error)}{" "}
              <button type="button" className="font-medium text-fg underline-offset-2 hover:underline" onClick={() => members.refetch()}>
                Try again
              </button>
            </p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {members.data.map((u) => (
                <li key={u.id} className="group/m flex h-11 items-center gap-2.5 rounded-sm px-2 hover:bg-hover">
                  <Avatar user={u} size="md" decorative />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-13 font-medium text-fg">
                      {displayName(u)} {u.id === meId && <span className="font-normal text-fg-muted">(you)</span>}
                    </span>
                    <span className="block truncate text-12 text-fg-muted">{u.email}</span>
                  </span>
                  {u.id === c.created_by && <Badge>Creator</Badge>}
                  {isAdmin && u.id !== meId && (
                    <IconButton
                      label={`Remove ${displayName(u)}`}
                      size="sm"
                      className="opacity-0 group-hover/m:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                      onClick={() => setRemoving({ id: u.id, name: displayName(u) })}
                    >
                      <UserMinus aria-hidden />
                    </IconButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {c.is_member && (
          <div className="border-t border-border-subtle px-4 py-3">
            <Button variant="ghost" className="text-danger-text hover:bg-danger-subtle hover:text-danger-text" onClick={() => setConfirmLeave(true)}>
              <LogOut aria-hidden /> Leave channel
            </Button>
          </div>
        )}
      </SheetContent>

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={`Leave #${c.name}`}
        description={
          c.is_private
            ? "You'll need someone to add you back to see this channel again."
            : "You can rejoin any time from Browse channels."
        }
        confirmLabel={`Leave #${c.name}`}
        loading={leave.isPending}
        onConfirm={() =>
          leave.mutate(c, {
            onSuccess: () => {
              setConfirmLeave(false);
              onOpenChange(false);
              toast.success(`You left #${c.name}`);
              router.push("/messages");
            },
            onError: (e) => toast.error("Couldn't leave the channel", { description: errorMessage(e) }),
          })
        }
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.name ?? ""}`}
        description={`They'll stop getting messages from #${c.name}${c.is_private ? " and won't be able to see it" : ""}.`}
        confirmLabel={`Remove ${removing?.name ?? ""}`}
        loading={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.id, {
            onSuccess: () => setRemoving(null),
            onError: (e) => toast.error(`Couldn't remove ${removing.name}`, { description: errorMessage(e) }),
          })
        }
      />
    </Sheet>
  );
}

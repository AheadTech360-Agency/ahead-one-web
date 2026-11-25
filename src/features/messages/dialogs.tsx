"use client";

import { Hash, Lock, RotateCw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import { useConversations, useMembers } from "@/lib/api/hooks";
import type { Conversation } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { roleAtLeast, useWorkspace } from "@/lib/workspace";
import { Button } from "@/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/ui/dialog";
import { EmptyState } from "@/ui/empty-state";
import { Field } from "@/ui/field";
import { Input, Textarea } from "@/ui/input";
import { Skeleton } from "@/ui/skeleton";
import { toast } from "@/ui/toaster";
import { UserPicker } from "@/ui/user-picker";
import { useBrowseChannels, useCreateChannel, useJoinChannel, useOpenDm } from "./api";
import { CHANNEL_NAME, displayName, normalizeChannelName } from "./format";
import { PersonList } from "./person-picker";
import { openMessagesDialog, useMessagesDialog } from "./stores";

const close = () => openMessagesDialog(null);

/* ---------- New direct message ---------- */

function NewDmDialog() {
  const router = useRouter();
  const { workspaceId, me } = useWorkspace();
  const members = useMembers(workspaceId);
  const open = useOpenDm(workspaceId);
  const people = (members.data ?? []).map((m) => m.user).filter((u) => u.id !== me?.user.id);

  return (
    <DialogContent title="New direct message" description="Pick a teammate. If you've talked before, the existing conversation opens." className="p-0">
      <div className="mt-2 min-h-0 border-t border-border-subtle">
        {members.isPending ? (
          <div className="flex flex-col gap-3 p-4" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-3 w-40" />
              </div>
            ))}
          </div>
        ) : (members.isError && members.data === undefined) ? (
          <EmptyState
            compact
            tone="danger"
            icon={RotateCw}
            title="Couldn't load people"
            description={errorMessage(members.error)}
            action={<Button size="sm" onClick={() => members.refetch()}>Try again</Button>}
          />
        ) : (
          <PersonList
            label="People"
            people={people}
            empty="No one matches that name."
            busyId={open.isPending ? open.variables : null}
            onPick={(u) =>
              open.mutate(u.id, {
                onSuccess: (c) => {
                  close();
                  router.push(`/messages/${c.id}`);
                },
                onError: (e) => toast.error(`Couldn't open a conversation with ${displayName(u)}`, { description: errorMessage(e) }),
              })
            }
          />
        )}
      </div>
    </DialogContent>
  );
}

/* ---------- Create channel ---------- */

function CreateChannelDialog() {
  const router = useRouter();
  const { workspaceId, me } = useWorkspace();
  const members = useMembers(workspaceId);
  const create = useCreateChannel(workspaceId);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  const normalized = normalizeChannelName(name);
  const people = (members.data ?? []).map((m) => m.user).filter((u) => u.id !== me?.user.id);

  function validate(v: string) {
    const n = normalizeChannelName(v);
    if (!n) return "Give the channel a name.";
    if (!/^[a-z0-9]/.test(n)) return "Start the name with a letter or number.";
    if (!CHANNEL_NAME.test(n)) return "Use lowercase letters, numbers, - and _ only (up to 80).";
    return null;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate(name);
    setNameError(err);
    if (err) return;
    create.mutate(
      { name: normalized, topic: topic.trim() || undefined, is_private: isPrivate, member_ids: memberIds },
      {
        onSuccess: (c) => {
          close();
          toast.success(`Created #${c.name}`);
          router.push(`/messages/${c.id}`);
        },
        onError: (e) =>
          toast.error("Couldn't create the channel", {
            description: errorMessage(e, "Check the name and try again."),
          }),
      },
    );
  }

  return (
    <DialogContent title="Create a channel" description="Channels keep a topic or team's conversation in one place.">
      <form onSubmit={submit} className="flex min-h-0 flex-col">
        <DialogBody className="flex flex-col gap-4">
          <Field
            label="Name"
            error={nameError}
            hint={normalized && normalized !== name ? `Saved as #${normalized}` : "Lowercase letters, numbers, - and _"}
          >
            <Input
              value={name}
              autoFocus
              maxLength={81}
              placeholder="design-reviews"
              leading={isPrivate ? <Lock /> : <Hash />}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(validate(e.target.value));
              }}
              onBlur={() => name && setNameError(validate(name))}
            />
          </Field>
          <Field label="Topic" optional>
            <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={250} rows={2} placeholder="What this channel is for" />
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-13 font-medium text-fg">Who can find it</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { v: false, icon: Hash, title: "Public", line: "Anyone in the workspace can join" },
                { v: true, icon: Lock, title: "Private", line: "Only people you add can see it" },
              ].map((o) => (
                <label
                  key={o.title}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-md border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                    isPrivate === o.v ? "border-accent bg-accent-subtle" : "border-border hover:border-border-strong",
                  )}
                >
                  <input type="radio" name="visibility" className="sr-only" checked={isPrivate === o.v} onChange={() => setPrivate(o.v)} />
                  <o.icon className={cn("mt-0.5 size-4 shrink-0", isPrivate === o.v ? "text-accent-text" : "text-fg-faint")} aria-hidden />
                  <span>
                    <span className="block text-13 font-medium text-fg">{o.title}</span>
                    <span className="block text-12 text-fg-muted">{o.line}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Add people" optional hint="You can add more later from the channel's details.">
            <UserPicker users={people} value={memberIds} onChange={setMemberIds} placeholder="Choose people" aria-label="Add people" className="w-full justify-start" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Create channel
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/* ---------- Browse channels ---------- */

function BrowseDialog() {
  const router = useRouter();
  const { workspaceId, role } = useWorkspace();
  const browse = useBrowseChannels(workspaceId, true);
  const mine = useConversations(workspaceId);
  const join = useJoinChannel();
  const [term, setTerm] = useState("");
  const canCreate = roleAtLeast(role, "member");

  const joined = useMemo(() => (mine.data ?? []).filter((c) => c.kind === "channel"), [mine.data]);
  const t = term.trim().toLowerCase();
  const match = (c: Conversation) => !t || (c.name ?? "").includes(t) || (c.topic ?? "").toLowerCase().includes(t);
  const available = (browse.data ?? []).filter(match);
  const mineShown = joined.filter(match);

  function go(c: Conversation) {
    close();
    router.push(`/messages/${c.id}`);
  }

  const row = (c: Conversation, action: React.ReactNode) => (
    <li key={c.id} className="flex items-center gap-3 rounded-sm px-2 py-2 hover:bg-hover">
      <span className="flex size-8 shrink-0 items-center justify-center text-fg-faint">
        {c.is_private ? <Lock className="size-4" strokeWidth={1.75} aria-hidden /> : <Hash className="size-4" strokeWidth={1.75} aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-13 font-medium text-fg">{c.name}</span>
        <span className="block truncate text-12 text-fg-muted">
          {c.member_count} {c.member_count === 1 ? "member" : "members"}
          {c.topic ? `, ${c.topic}` : ""}
        </span>
      </span>
      {action}
    </li>
  );

  return (
    <DialogContent title="Browse channels" size="lg" description="Join public channels to follow along.">
      <div className="px-5 pt-2">
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search channels" aria-label="Search channels" leading={<Search />} autoFocus />
      </div>
      <DialogBody className="min-h-64">
        {browse.isPending ? (
          <div className="flex flex-col gap-3 py-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-sm" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : (browse.isError && browse.data === undefined) ? (
          <EmptyState
            compact
            tone="danger"
            icon={RotateCw}
            title="Couldn't load channels"
            description={errorMessage(browse.error)}
            action={<Button size="sm" onClick={() => browse.refetch()}>Try again</Button>}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <section aria-labelledby="browse-available">
              <h3 id="browse-available" className="px-2 pb-1 text-12 font-medium text-fg-muted">
                Channels you can join
              </h3>
              {available.length === 0 ? (
                <p className="px-2 py-3 text-13 text-fg-muted">
                  {t ? "No public channels match that search." : "You're already in every public channel."}
                </p>
              ) : (
                <ul className="flex flex-col">
                  {available.map((c) =>
                    row(
                      c,
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={join.isPending && join.variables === c.id}
                        onClick={() =>
                          join.mutate(c.id, {
                            onSuccess: (joinedC) => go(joinedC),
                            onError: (e) => toast.error(`Couldn't join #${c.name}`, { description: errorMessage(e) }),
                          })
                        }
                      >
                        Join
                      </Button>,
                    ),
                  )}
                </ul>
              )}
            </section>
            {mineShown.length > 0 && (
              <section aria-labelledby="browse-mine">
                <h3 id="browse-mine" className="px-2 pb-1 text-12 font-medium text-fg-muted">
                  Your channels
                </h3>
                <ul className="flex flex-col">
                  {mineShown.map((c) =>
                    row(
                      c,
                      <Button size="sm" variant="ghost" onClick={() => go(c)}>
                        Open
                      </Button>,
                    ),
                  )}
                </ul>
              </section>
            )}
          </div>
        )}
      </DialogBody>
      {canCreate && (
        <DialogFooter className="justify-between">
          <p className="text-12 text-fg-muted">Can&apos;t find it?</p>
          <Button size="sm" onClick={() => openMessagesDialog("channel")}>
            Create a channel
          </Button>
        </DialogFooter>
      )}
    </DialogContent>
  );
}

/** Mounted once in the app layout: the messaging dialogs opened from the sidebar, list and palette. */
export function MessagesDialogs() {
  const which = useMessagesDialog();
  return (
    <Dialog open={which !== null} onOpenChange={(o) => !o && close()}>
      {which === "dm" && <NewDmDialog />}
      {which === "channel" && <CreateChannelDialog key="channel" />}
      {which === "browse" && <BrowseDialog />}
    </Dialog>
  );
}

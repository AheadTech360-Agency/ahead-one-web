"use client";

import { isSameDay } from "date-fns";
import { ArrowDown, Check, CircleAlert, Copy, Hash, Lock, Pencil, RotateCw, Trash2 } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import type { Conversation, Message, ReadState, UserSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/dialog";
import { IconButton } from "@/ui/icon-button";
import { Skeleton } from "@/ui/skeleton";
import { Spinner } from "@/ui/spinner";
import { toast } from "@/ui/toaster";
import { Tooltip } from "@/ui/tooltip";
import { useDeleteMessage, useEditMessage, useMessages, useSendMessage } from "./api";
import { newer } from "./cache";
import { Composer } from "./composer";
import {
  continues,
  conversationName,
  dayLabel,
  decodeMentions,
  displayName,
  dmPartner,
  plainBody,
  timeLabel,
  type People,
} from "./format";
import { Attachments, MessageText } from "./message-body";
import { usePendingMessages, type PendingMessage } from "./stores";

type Row =
  | { kind: "message"; m: Message; grouped: boolean }
  | { kind: "pending"; p: PendingMessage; grouped: boolean; author: UserSummary | undefined };

/* ---------- Rows ---------- */

function Gutter({ author, grouped, at }: { author: UserSummary | null | undefined; grouped: boolean; at: string }) {
  if (!grouped) {
    return author ? (
      <Avatar user={author} size="md" decorative className="mt-0.5" />
    ) : (
      <span className="mt-0.5 size-8 shrink-0 rounded-full bg-active" aria-hidden />
    );
  }
  return (
    <time
      dateTime={at}
      className="w-8 shrink-0 pt-[3px] text-right text-11 leading-4 text-fg-faint opacity-0 tabular group-hover/row:opacity-100 group-focus-within/row:opacity-100"
    >
      {timeLabel(new Date(at)).replace(/ [AP]M$/, "")}
    </time>
  );
}

function Header({ author, at, edited, meId }: { author: UserSummary | null; at: string; edited?: boolean; meId?: string }) {
  const d = new Date(at);
  return (
    <div className="flex items-baseline gap-2">
      <span className="truncate text-14 font-semibold text-fg">
        {displayName(author)}
        {author?.id === meId && <span className="sr-only"> (you)</span>}
      </span>
      <Tooltip content={d.toLocaleString()} side="top">
        <time dateTime={at} className="shrink-0 text-11 text-fg-faint tabular">
          {timeLabel(d)}
        </time>
      </Tooltip>
      {edited && <span className="text-11 text-fg-faint">(edited)</span>}
    </div>
  );
}

function MessageRow({
  m,
  fresh,
  grouped,
  meId,
  people,
  candidates,
  editing,
  onEdit,
  onEditDone,
}: {
  m: Message;
  /** Arrived while the conversation was open: fade in. */
  fresh?: boolean;
  grouped: boolean;
  meId?: string;
  people: People;
  candidates: UserSummary[];
  editing: boolean;
  onEdit: () => void;
  onEditDone: () => void;
}) {
  const mine = Boolean(meId && m.author?.id === meId);
  const edit = useEditMessage();
  const del = useDeleteMessage();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mentionsMe = Boolean(meId && m.body.includes(`<@${meId}>`));
  const decoded = useMemo(() => (editing ? decodeMentions(m.body, people) : null), [editing, m.body, people]);

  return (
    <div
      data-message-id={m.id}
      className={cn(
        "group/row relative flex gap-3 px-4 sm:px-5",
        grouped ? "py-0.5" : "pb-0.5 pt-2",
        fresh && "animate-in-fade",
        editing ? "bg-accent-subtle/50" : mentionsMe ? "bg-warning-subtle/60" : "hover:bg-hover focus-within:bg-hover",
      )}
    >
      <Gutter author={m.author} grouped={grouped} at={m.created_at} />
      <div className="min-w-0 flex-1">
        {!grouped && <Header author={m.author} at={m.created_at} meId={meId} />}
        {m.deleted ? (
          <p className="flex items-center gap-1.5 text-13 italic text-fg-faint">
            <Trash2 className="size-3.5" aria-hidden /> This message was deleted.
          </p>
        ) : editing && decoded ? (
          <div className="py-1">
            <Composer
              conversationId={m.conversation_id}
              candidates={candidates}
              meId={meId}
              mode="edit"
              placeholder="Edit message"
              initialText={decoded.text}
              initialMentions={decoded.mentions}
              autoFocus
              disabled={edit.isPending}
              onCancel={onEditDone}
              onSubmit={(body) => {
                if (body === m.body) return onEditDone();
                edit.mutate(
                  { id: m.id, body },
                  {
                    onSuccess: onEditDone,
                    onError: (e) => toast.error("Couldn't save your edit", { description: `${errorMessage(e)} Your text is still in the editor.` }),
                  },
                );
              }}
            />
          </div>
        ) : (
          <>
            {m.body && (
              <MessageText body={m.body} people={people} meId={meId} edited={Boolean(m.edited_at)} className="text-14 leading-[22px] text-fg" />
            )}
            <Attachments items={m.attachments} />
          </>
        )}
      </div>

      {!m.deleted && !editing && (
        <div
          className={cn(
            "absolute -top-3.5 right-4 flex items-center gap-px rounded-sm border border-border bg-surface-raised p-0.5 shadow-xs",
            "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 [@media(hover:none)]:hidden",
          )}
        >
          {m.body && (
            <IconButton
              label="Copy text"
              size="sm"
              className="size-6"
              onClick={() => {
                void navigator.clipboard
                  .writeText(plainBody(m.body, people))
                  .then(() => toast.success("Copied to clipboard"))
                  .catch(() => toast.error("Couldn't copy. Select the text and copy it instead."));
              }}
            >
              <Copy aria-hidden />
            </IconButton>
          )}
          {mine && (
            <>
              <IconButton label="Edit message" size="sm" className="size-6" onClick={onEdit}>
                <Pencil aria-hidden />
              </IconButton>
              <IconButton label="Delete message" size="sm" className="size-6 hover:text-danger-text" onClick={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden />
              </IconButton>
            </>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete message"
        description="It's removed for everyone in this conversation. This can't be undone."
        confirmLabel="Delete message"
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(m, {
            onSuccess: () => setConfirmDelete(false),
            onError: (e) => toast.error("Couldn't delete the message", { description: `${errorMessage(e)} Try again.` }),
          })
        }
      />
    </div>
  );
}

function PendingRow({
  p,
  grouped,
  author,
  people,
  meId,
  onRetry,
  onDiscard,
}: {
  p: PendingMessage;
  grouped: boolean;
  author: UserSummary | undefined;
  people: People;
  meId?: string;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const failed = p.status === "failed";
  return (
    <div className={cn("group/row flex gap-3 px-4 animate-in-fade sm:px-5", grouped ? "py-0.5" : "pb-0.5 pt-2")} aria-busy={!failed}>
      <Gutter author={author ?? null} grouped={grouped} at={p.createdAt} />
      <div className="min-w-0 flex-1">
        {!grouped && <Header author={author ?? null} at={p.createdAt} meId={meId} />}
        <div className={cn(!failed && "opacity-60")}>
          {p.body && <MessageText body={p.body} people={people} meId={meId} className="text-14 leading-[22px] text-fg" />}
          <Attachments items={p.attachments} />
        </div>
        {failed ? (
          <div className="mt-0.5 flex items-start gap-1.5 text-12 text-danger-text" role="alert">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="flex flex-wrap items-center gap-x-2">
            <span>Not sent{p.error ? `: ${p.error}` : "."}</span>
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
              <RotateCw className="size-3" aria-hidden /> Retry
            </button>
            <button type="button" onClick={onDiscard} className="font-medium text-fg-muted underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
              Discard
            </button>
            </span>
          </div>
        ) : (
          <span className="text-11 text-fg-faint">Sending…</span>
        )}
      </div>
    </div>
  );
}

function DaySeparator({ date }: { date: Date }) {
  return (
    <div className="relative flex justify-center pb-1 pt-4" role="separator" aria-label={dayLabel(date)}>
      <span className="absolute inset-x-4 top-[calc(50%+6px)] h-px bg-border sm:inset-x-5" aria-hidden />
      <span className="relative rounded-full border border-border bg-surface px-2.5 py-0.5 text-12 font-medium text-fg-muted">
        {dayLabel(date)}
      </span>
    </div>
  );
}

function NewDivider() {
  return (
    <div className="relative my-1 flex items-center px-4 sm:px-5" role="separator" aria-label="New messages">
      <span className="h-px flex-1 bg-green" aria-hidden />
      <span className="ml-2 text-11 font-semibold text-green-text">New</span>
    </div>
  );
}

function Intro({ c, meId }: { c: Conversation; meId?: string }) {
  const partner = c.kind === "dm" ? dmPartner(c, meId) : undefined;
  return (
    <div className="px-4 pb-4 pt-10 sm:px-5">
      {partner ? (
        <Avatar user={partner} size="lg" decorative />
      ) : (
        <span className="flex size-10 items-center justify-center rounded-md bg-active text-fg-muted">
          {c.is_private ? <Lock className="size-5" aria-hidden /> : <Hash className="size-5" aria-hidden />}
        </span>
      )}
      <h2 className="mt-3 text-20 font-semibold tracking-[-0.01em] text-fg">
        {c.kind === "channel" ? `Welcome to #${c.name}` : displayName(partner)}
      </h2>
      <p className="mt-1 max-w-prose text-13 text-fg-muted">
        {c.kind === "channel"
          ? c.topic
            ? c.topic
            : `This is the start of #${c.name}. ${c.is_private ? "Only invited members can see it." : "Anyone in the workspace can join."}`
          : partner?.id === meId
            ? "Jot down notes, drafts and links for yourself."
            : `This is the start of your conversation with ${conversationName(c, meId)}.`}
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col justify-end gap-5 px-5 py-5" role="status" aria-label="Loading messages">
      {[62, 40, 78, 30, 55].map((w, i) => (
        <div key={i} className="flex gap-3" aria-hidden>
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2 pt-0.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3" style={{ width: `${w}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- List ---------- */

/**
 * The message scroller. It is a column-reverse flex box with one child, so the browser keeps
 * the view anchored to the newest message, and loading older pages above doesn't jump.
 */
export function MessageList({
  conversation,
  meId,
  me,
  people,
  candidates,
  readStates,
  editingId,
  setEditingId,
  onAtBottomChange,
}: {
  conversation: Conversation;
  meId?: string;
  me?: UserSummary;
  people: People;
  candidates: UserSummary[];
  readStates: ReadState[] | undefined;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onAtBottomChange: (atBottom: boolean) => void;
}) {
  const q = useMessages(conversation.id);
  const pending = usePendingMessages(conversation.id);
  const send = useSendMessage(conversation.id);
  const scroller = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  // Where "New" goes: the read position when this conversation opened.
  const [openedAt] = useState(() => new Date().toISOString());
  const [readAtOpen] = useState(() => (conversation.unread_count > 0 ? conversation.last_read_message_id : undefined));

  const messages = useMemo(() => (q.data ? q.data.pages.flatMap((p) => p.items).reverse() : []), [q.data]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let prev: { author: UserSummary | null; created_at: string } | undefined;
    for (const m of messages) {
      const grouped = !m.deleted && continues(prev, m);
      out.push({ kind: "message", m, grouped });
      prev = m.deleted ? undefined : m;
    }
    for (const p of pending) {
      const author = me;
      const item = { author: author ?? null, created_at: p.createdAt };
      out.push({ kind: "pending", p, grouped: continues(prev, item), author });
      prev = item;
    }
    return out;
  }, [messages, pending, me]);

  const newest = messages.at(-1);

  // Day separators and the one "New" divider, worked out ahead of render.
  const decorated = useMemo(() => {
    let dividerShown = false;
    return rows.map((r, i) => {
      const at = new Date(r.kind === "message" ? r.m.created_at : r.p.createdAt);
      const prev = rows[i - 1];
      const prevAt = prev ? new Date(prev.kind === "message" ? prev.m.created_at : prev.p.createdAt) : null;
      const newDay = !prevAt || !isSameDay(prevAt, at);
      const showNew =
        !dividerShown &&
        r.kind === "message" &&
        readAtOpen !== undefined &&
        r.m.author?.id !== meId &&
        newer(r.m.id, readAtOpen);
      if (showNew) dividerShown = true;
      return { r, at, newDay, showNew };
    });
  }, [rows, readAtOpen, meId]);

  // Seen: in a DM, the other person has read up to (or past) your newest message.
  const seen = useMemo(() => {
    if (conversation.kind !== "dm" || !newest || newest.author?.id !== meId) return false;
    const other = readStates?.find((r) => r.user_id !== meId);
    return Boolean(other?.last_read_message_id && !newer(newest.id, other.last_read_message_id));
  }, [conversation.kind, newest, meId, readStates]);

  // Infinite scroll upward.
  useEffect(() => {
    const el = top.current;
    const root = scroller.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
      },
      { root, rootMargin: "600px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [q]);

  // Sending a message always brings you back down to it.
  const pendingCount = pending.length;
  useLayoutEffect(() => {
    if (pendingCount > 0) scroller.current?.scrollTo({ top: 0 });
  }, [pendingCount]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    // column-reverse: 0 at the bottom, negative as you scroll up.
    const bottom = Math.abs(el.scrollTop) < 80;
    if (bottom !== atBottom) {
      setAtBottom(bottom);
      onAtBottomChange(bottom);
    }
  }

  if (q.isPending) return <div className="flex min-h-0 flex-1 flex-col justify-end"><ListSkeleton /></div>;
  if (q.isError && !q.data) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <CircleAlert className="size-5 text-danger-text" aria-hidden />
        <div>
          <p className="text-14 font-semibold text-fg">Couldn&apos;t load messages</p>
          <p className="mt-1 text-13 text-fg-muted">{errorMessage(q.error)}</p>
        </div>
        <Button size="sm" onClick={() => q.refetch()}>
          <RotateCw aria-hidden /> Try again
        </Button>
      </div>
    );
  }

  const unreadCount = conversation.unread_count;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain"
        role="log"
        aria-label={`Messages in ${conversation.kind === "channel" ? `#${conversation.name}` : conversationName(conversation, meId)}`}
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={-1}
      >
        <div className="flex flex-col pb-3">
          <div ref={top} aria-hidden className="h-px" />
          {q.hasNextPage ? (
            <div className="flex h-10 items-center justify-center text-fg-faint">
              {q.isFetchingNextPage && <Spinner size={16} label="Loading older messages" />}
            </div>
          ) : (
            <Intro c={conversation} meId={meId} />
          )}
          {decorated.map(({ r, at, newDay, showNew }) => {
            const key = r.kind === "message" ? r.m.id : r.p.tempId;
            return (
              <Fragment key={key}>
                {newDay && <DaySeparator date={at} />}
                {showNew && <NewDivider />}
                {r.kind === "message" ? (
                  <MessageRow
                    m={r.m}
                    fresh={r.m.created_at > openedAt}
                    grouped={r.grouped && !newDay && !showNew}
                    meId={meId}
                    people={people}
                    candidates={candidates}
                    editing={editingId === r.m.id}
                    onEdit={() => setEditingId(r.m.id)}
                    onEditDone={() => setEditingId(null)}
                  />
                ) : (
                  <PendingRow
                    p={r.p}
                    grouped={r.grouped && !newDay}
                    author={r.author}
                    people={people}
                    meId={meId}
                    onRetry={() => void send.retry(r.p.tempId).catch(() => undefined)}
                    onDiscard={() => send.discard(r.p.tempId)}
                  />
                )}
              </Fragment>
            );
          })}
          {seen && pending.length === 0 && (
            <p className="flex items-center justify-end gap-1 px-5 pt-0.5 text-11 text-fg-faint">
              <Check className="size-3" aria-hidden /> Seen
            </p>
          )}
        </div>
      </div>
      {!atBottom && (
        <button
          type="button"
          onClick={() => scroller.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className="absolute bottom-3 left-1/2 inline-flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-surface-raised px-3 text-12 font-medium text-fg shadow-popover hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring animate-in-pop"
        >
          <ArrowDown className="size-3.5" aria-hidden />
          {unreadCount > 0 ? `${unreadCount} new ${unreadCount === 1 ? "message" : "messages"}` : "Jump to latest"}
        </button>
      )}
    </div>
  );
}

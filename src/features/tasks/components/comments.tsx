"use client";

import { CircleAlert, MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import type { Comment, UserSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/dialog";
import { EmptyState } from "@/ui/empty-state";
import { IconButton } from "@/ui/icon-button";
import { Kbd } from "@/ui/kbd";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/menu";
import { Skeleton } from "@/ui/skeleton";
import { useComments, useCreateComment, useDeleteComment, useEditComment } from "../api";
import { absoluteTime, relativeTime } from "../lib/dates";
import { RichTextEditor, type RichTextEditorHandle } from "../rich-text/editor";
import { RichTextView } from "../rich-text/rich-text-view";
import { isEmptyDoc } from "../rich-text/schema";

export function CommentsThread({
  taskId,
  me,
  people,
  canComment,
  canModerate,
}: {
  taskId: string;
  me: UserSummary | undefined;
  people: UserSummary[];
  canComment: boolean;
  /** Project managers may delete anyone's comment. */
  canModerate: boolean;
}) {
  const q = useComments(taskId);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-1">
      {q.isPending ? (
        <div role="status" aria-label="Loading comments" className="flex flex-col gap-5 py-3">
          {[80, 55].map((w, i) => (
            <div key={i} className="flex gap-2.5">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3" style={{ width: `${w}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : q.isError ? (
        <EmptyState
          compact
          tone="danger"
          icon={CircleAlert}
          title="Comments didn't load"
          description={errorMessage(q.error)}
          action={<Button size="sm" onClick={() => void q.refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon={MessageSquare}
          title="No comments yet"
          description={canComment ? "Ask a question or share an update. Type @ to mention someone." : "Comments from the team show up here."}
        />
      ) : (
        <>
          {q.hasNextPage && (
            <Button size="sm" variant="ghost" className="self-start" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
              Show more comments
            </Button>
          )}
          <ol className="flex flex-col">
            {items.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                taskId={taskId}
                people={people}
                mine={c.author?.id === me?.id}
                canComment={canComment}
                canModerate={canModerate}
              />
            ))}
          </ol>
        </>
      )}
      {canComment && <Composer taskId={taskId} me={me} people={people} />}
    </div>
  );
}

function CommentItem({
  comment,
  taskId,
  people,
  mine,
  canComment,
  canModerate,
}: {
  comment: Comment;
  taskId: string;
  people: UserSummary[];
  mine: boolean;
  canComment: boolean;
  canModerate: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const edit = useEditComment(taskId);
  const del = useDeleteComment(taskId);
  const editor = useRef<RichTextEditorHandle>(null);
  const pending = comment.id.startsWith("pending-");
  const name = comment.author ? comment.author.full_name || comment.author.email : "Former member";

  function save() {
    const body = editor.current?.getJSON();
    if (!body || isEmptyDoc(body)) return;
    edit.mutate({ id: comment.id, body });
    setEditing(false);
  }

  return (
    <li className={cn("group/c flex gap-2.5 py-3", pending && "opacity-60")}>
      {comment.author ? (
        <Avatar user={comment.author} size="sm" decorative className="mt-0.5" />
      ) : (
        <span className="mt-0.5 size-6 shrink-0 rounded-full bg-active" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex h-6 items-center gap-2">
          <span className="truncate text-13 font-semibold text-fg">{name}</span>
          <time dateTime={comment.created_at} title={absoluteTime(comment.created_at)} className="text-12 text-fg-faint">
            {pending ? "Posting" : relativeTime(comment.created_at)}
          </time>
          {comment.edited_at && !pending && (
            <span className="text-12 text-fg-faint" title={absoluteTime(comment.edited_at)}>
              (edited)
            </span>
          )}
          {!pending && ((mine && canComment) || canModerate) && !editing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton
                  label="Comment actions"
                  size="sm"
                  noTooltip
                  className="ml-auto opacity-0 focus-visible:opacity-100 group-hover/c:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  <MoreHorizontal aria-hidden />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {mine && canComment && (
                  <DropdownMenuItem onSelect={() => setEditing(true)}>
                    <Pencil aria-hidden /> Edit comment
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem danger onSelect={() => setConfirm(true)}>
                  <Trash2 aria-hidden /> Delete comment
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {editing ? (
          <div className="mt-1 rounded-md border border-ring bg-surface p-2">
            <RichTextEditor
              ref={editor}
              initial={comment.body}
              members={people}
              variant="compact"
              autofocus
              aria-label="Edit comment"
              onSubmit={save}
              onCancel={() => setEditing(false)}
            />
            <div className="mt-2 flex items-center justify-end gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={save}>
                Save comment
              </Button>
            </div>
          </div>
        ) : (
          <RichTextView doc={comment.body} />
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this comment?"
        description={mine ? "It's removed for everyone on this task." : `${name}'s comment is removed for everyone on this task.`}
        confirmLabel="Delete comment"
        onConfirm={() => {
          del.mutate(comment.id);
          setConfirm(false);
        }}
      />
    </li>
  );
}

function Composer({ taskId, me, people }: { taskId: string; me: UserSummary | undefined; people: UserSummary[] }) {
  const create = useCreateComment(taskId, me);
  const editor = useRef<RichTextEditorHandle>(null);
  const [empty, setEmpty] = useState(true);
  const [focused, setFocused] = useState(false);

  function submit() {
    const body = editor.current?.getJSON();
    if (!body || isEmptyDoc(body)) return;
    editor.current?.clear();
    setEmpty(true);
    create.mutate(body, {
      // Put the text back so nothing typed is lost.
      onError: () => editor.current?.setContent(body),
    });
  }

  return (
    <div className="mt-2 flex gap-2.5">
      {me ? <Avatar user={me} size="sm" decorative className="mt-2" /> : <span className="size-6" />}
      <div
        className={cn(
          "min-w-0 flex-1 rounded-md border bg-surface px-3 py-2 transition-[border-color,box-shadow] duration-[var(--dur-fast)]",
          focused ? "border-ring ring-[3px] ring-[color-mix(in_srgb,var(--ring)_22%,transparent)]" : "border-border-strong",
        )}
        onFocus={() => setFocused(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}
      >
        <RichTextEditor
          ref={editor}
          initial={null}
          members={people}
          variant="compact"
          placeholder="Write a comment. Type @ to mention someone."
          aria-label="New comment"
          onChange={(doc) => setEmpty(isEmptyDoc(doc))}
          onSubmit={submit}
        />
        <div className={cn("flex items-center justify-end gap-2 pt-1", !focused && empty && "hidden")}>
          <span className="hidden items-center gap-1 text-12 text-fg-faint sm:flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>Enter</Kbd>
          </span>
          <Button size="sm" variant="primary" disabled={empty} loading={create.isPending} onClick={submit}>
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { format } from "date-fns";
import { Check, CircleAlert, CornerLeftUp, FolderInput, Link2, Lock, Maximize2, MoreHorizontal, SearchX, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MoveToSharedDialog } from "@/features/personal/move-to-shared";
import { isPersonalProject } from "@/features/personal/logic";
import { errorMessage, isApiError } from "@/lib/api/client";
import { useTree } from "@/lib/api/hooks";
import type { JsonValue, Task, TaskDetail as TaskDetailData, UserSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/dialog";
import { EmptyState } from "@/ui/empty-state";
import { IconButton } from "@/ui/icon-button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/menu";
import { Skeleton } from "@/ui/skeleton";
import { Spinner } from "@/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { toast } from "@/ui/toaster";
import { useDeleteTask, useSaveDescription, useTask, useUpdateTask } from "../api";
import { projectAccess, type Access } from "../lib/access";
import { absoluteTime } from "../lib/dates";
import { RichTextEditor } from "../rich-text/lazy-editor";
import { RichTextView } from "../rich-text/rich-text-view";
import { isEmptyDoc } from "../rich-text/schema";
import { ActivityList } from "./activity";
import { Attachments } from "./attachments";
import { CommentsThread } from "./comments";
import { Subtasks } from "./subtasks";
import { AssigneeControl, DueControl, PriorityControl, StatusControl, useAssignable } from "./task-controls";

export type DetailLayout = "page" | "panel";

/**
 * One task, shown either as a full page or inside the slide-over. Everything edits in place and
 * respects the caller's project permission (my_permission): view-only and comment-only people
 * see the same layout with read-only fields.
 */
export function TaskDetail({
  taskId,
  layout,
  hrefFor,
  onDeleted,
  onClose,
}: {
  taskId: string;
  /** Slide-over only: renders a close button in the toolbar. */
  onClose?: () => void;
  layout: DetailLayout;
  /** Where a related task (parent, subtask) opens: the slide-over or the full page. */
  hrefFor: (id: string) => string;
  onDeleted?: () => void;
}) {
  const q = useTask(taskId);
  const { me } = useWorkspace();
  const meId = me?.user.id;
  const people = useAssignable(q.data?.project.id);

  if (q.isPending) return <DetailSkeleton layout={layout} onClose={onClose} />;
  if ((q.isError && q.data === undefined)) {
    const gone = isApiError(q.error) && (q.error.status === 404 || q.error.status === 403);
    return (
      <>
      {onClose && (
        <div className="flex h-11 items-center justify-end border-b border-border-subtle px-4">
          <CloseButton onClose={onClose} />
        </div>
      )}
      <EmptyState
        className="py-20"
        tone={gone ? "neutral" : "danger"}
        icon={gone ? SearchX : CircleAlert}
        title={gone ? "This task isn't available" : "The task didn't load"}
        description={gone ? "It was deleted, or you no longer have access to its project." : errorMessage(q.error)}
        action={
          gone ? (
            <Button asChild>
              <Link href="/my-tasks">Go to My tasks</Link>
            </Button>
          ) : (
            <Button onClick={() => void q.refetch()}>Try again</Button>
          )
        }
      />
      </>
    );
  }

  const detail = q.data;
  const access = projectAccess(detail.project, meId);
  const meSummary: UserSummary | undefined = me
    ? { id: me.user.id, full_name: me.user.full_name, email: me.user.email, avatar_url: me.user.avatar_url }
    : undefined;

  return (
    <DetailBody
      key={detail.task.id}
      detail={detail}
      access={access}
      layout={layout}
      people={people}
      me={meSummary}
      hrefFor={hrefFor}
      onDeleted={onDeleted}
      onClose={onClose}
    />
  );
}

function DetailBody({
  detail,
  access,
  layout,
  people,
  me,
  hrefFor,
  onDeleted,
  onClose,
}: {
  detail: TaskDetailData;
  access: Access;
  layout: DetailLayout;
  people: UserSummary[];
  me: UserSummary | undefined;
  hrefFor: (id: string) => string;
  onDeleted?: () => void;
  onClose?: () => void;
}) {
  const { task, project, list, statuses } = detail;
  const panel = layout === "panel";
  const tree = useTree(useWorkspace().workspaceId);

  const properties = (
    <dl
      className={cn(
        "grid items-center gap-x-3 gap-y-0.5 text-13",
        panel ? "grid-cols-[96px_minmax(0,1fr)] sm:grid-cols-[96px_minmax(0,1fr)_96px_minmax(0,1fr)]" : "grid-cols-[96px_minmax(0,1fr)]",
      )}
    >
      <Prop label="Status">
        <StatusControl task={task} statuses={statuses} disabled={!access.canChangeStatus(task)} showChevron />
      </Prop>
      <Prop label="Priority">
        <PriorityControl task={task} disabled={!access.canEdit} />
      </Prop>
      <Prop label="Assignees">
        <AssigneeControl task={task} users={people} disabled={!access.canEdit} />
      </Prop>
      <Prop label="Due">
        <DueControl task={task} disabled={!access.canEdit} variant="inline" emptyLabel="No due date" />
      </Prop>
      {!panel && (
        <>
          <Prop label="List">
            <Link href={`/l/${list.id}`} className="truncate px-1 text-fg hover:underline">
              {list.name}
            </Link>
          </Prop>
          <Prop label="Created">
            <span className="flex min-w-0 items-center gap-1.5 px-1 text-fg-muted" title={absoluteTime(task.created_at)}>
              {task.created_by && <Avatar user={task.created_by} size="xs" decorative />}
              <span className="truncate">
                {task.created_by ? `${task.created_by.full_name.split(" ")[0]}, ` : ""}
                {format(new Date(task.created_at), "MMM d")}
              </span>
            </span>
          </Prop>
        </>
      )}
    </dl>
  );

  const main = (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-3">
        {task.parent_task_id && <ParentLink detail={detail} hrefFor={hrefFor} />}
        <TitleField task={task} editable={access.canEdit} large={!panel} />
        {access.readOnlyReason && (
          <p className="rounded-sm bg-surface-sunken px-3 py-2 text-12 text-fg-muted">{access.readOnlyReason}</p>
        )}
        {panel && properties}
      </div>

      <Section title="Description">
        <Description detail={detail} editable={access.canEdit} people={people} />
      </Section>

      {!task.parent_task_id && (
        <Section title="Subtasks" count={detail.subtasks.length}>
          <Subtasks detail={detail} statuses={statuses} access={access} hrefFor={hrefFor} />
        </Section>
      )}

      <Section title="Files" count={detail.attachments.length}>
        <Attachments
          taskId={task.id}
          taskTitle={task.title}
          attachments={detail.attachments}
          me={me}
          canUpload={access.canComment}
          canManage={access.canManage}
        />
      </Section>

      <Tabs defaultValue="comments">
        <TabsList>
          <TabsTrigger value="comments">
            Comments
            {task.comment_count > 0 && <span className="text-12 text-fg-faint tabular">{task.comment_count}</span>}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="comments" className="outline-none">
          <CommentsThread
            taskId={task.id}
            taskTitle={task.title}
            me={me}
            people={people}
            canComment={access.canComment}
            canModerate={access.canManage}
          />
        </TabsContent>
        <TabsContent value="activity" className="outline-none">
          <ActivityList taskId={task.id} people={people} />
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <div className="flex flex-col">
      <Toolbar detail={detail} access={access} layout={layout} onDeleted={onDeleted} onClose={onClose} />
      {panel ? (
        <div className="px-4 pb-10 pt-3 sm:px-5">{main}</div>
      ) : (
        <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 pb-16 pt-4 sm:px-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          {main}
          <aside className="order-first lg:order-none">
            <div className="flex flex-col gap-3 rounded-md border border-border p-3 lg:sticky lg:top-4">
              <h2 className="sr-only">Details</h2>
              {properties}
              <p className="border-t border-border-subtle pt-3 text-12 text-fg-muted">
                {isPersonalProject(tree.data, project.id) ? (
                  <span className="inline-flex items-center gap-1 font-medium text-fg">
                    <Lock className="size-3.5" aria-hidden /> Private to you
                  </span>
                ) : (
                  <>
                    In{" "}
                    <Link href={`/p/${project.id}`} className="font-medium text-fg hover:underline">
                      {project.name}
                    </Link>
                  </>
                )}
                . Updated {format(new Date(task.updated_at), "MMM d 'at' h:mm a")}.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="flex h-8 items-center text-12 text-fg-muted">{label}</dt>
      <dd className="flex h-8 min-w-0 items-center">{children}</dd>
    </>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-13 font-semibold text-fg">
        {title}
        {count ? <span className="text-12 font-normal text-fg-faint tabular">{count}</span> : null}
      </h2>
      {children}
    </section>
  );
}

function ParentLink({ detail, hrefFor }: { detail: TaskDetailData; hrefFor: (id: string) => string }) {
  return (
    <Link
      href={hrefFor(detail.task.parent_task_id!)}
      scroll={false}
      className="inline-flex w-fit items-center gap-1.5 rounded-xs text-12 text-fg-muted hover:text-fg hover:underline"
    >
      <CornerLeftUp className="size-3.5" aria-hidden /> Subtask of the parent task
    </Link>
  );
}

/* ---------- Toolbar ---------- */

function Toolbar({
  detail,
  access,
  layout,
  onDeleted,
  onClose,
}: {
  detail: TaskDetailData;
  access: Access;
  layout: DetailLayout;
  onDeleted?: () => void;
  onClose?: () => void;
}) {
  const { task, project, list } = detail;
  const router = useRouter();
  const del = useDeleteTask();
  const [confirm, setConfirm] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { workspaceId } = useWorkspace();
  const isPrivate = isPersonalProject(useTree(workspaceId).data, project.id);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/t/${task.id}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy the link", { description: "Your browser blocked clipboard access. Copy it from the address bar." });
    }
  }

  return (
    <div
      className={cn(
        "flex h-11 items-center gap-2 border-b border-border-subtle",
        layout === "panel" ? "px-4 sm:px-5" : "mx-auto w-full max-w-[1200px] px-4 sm:px-6 md:px-8",
      )}
    >
      <nav aria-label="Task location" className="flex min-w-0 flex-1 items-center gap-1 text-12 text-fg-muted">
        {isPrivate ? (
          <Lock className="size-3 shrink-0" aria-hidden />
        ) : (
          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
        )}
        {isPrivate ? (
          <span className="truncate">Private, only you</span>
        ) : (
          <Link href={`/p/${project.id}`} className="truncate hover:text-fg hover:underline">
            {project.name}
          </Link>
        )}
        <span aria-hidden>/</span>
        <Link href={`/l/${list.id}`} className="truncate hover:text-fg hover:underline">
          {list.name}
        </Link>
      </nav>
      <IconButton label={copied ? "Link copied" : "Copy link"} size="sm" onClick={() => void copy()}>
        {copied ? <Check aria-hidden /> : <Link2 aria-hidden />}
      </IconButton>
      {layout === "panel" && (
        <IconButton label="Open full page" size="sm" onClick={() => router.push(`/t/${task.id}`)}>
          <Maximize2 aria-hidden />
        </IconButton>
      )}
      {access.canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="More actions" size="sm" noTooltip>
              <MoreHorizontal aria-hidden />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isPrivate && !task.parent_task_id && (
              <DropdownMenuItem onSelect={() => setMoveOpen(true)}>
                <FolderInput aria-hidden /> Move to a shared project
              </DropdownMenuItem>
            )}
            <DropdownMenuItem danger onSelect={() => setConfirm(true)}>
              <Trash2 aria-hidden /> Delete task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {onClose && <CloseButton onClose={onClose} />}
      {isPrivate && <MoveToSharedDialog task={task} open={moveOpen} onOpenChange={setMoveOpen} />}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete "${task.title}"?`}
        description={
          task.subtask_count > 0
            ? `Its ${task.subtask_count} subtasks, comments and files are deleted with it.`
            : "Its comments and files are deleted with it."
        }
        confirmLabel="Delete task"
        onConfirm={() => {
          setConfirm(false);
          del.mutate(task, {
            onSuccess: () => {
              toast.success("Task deleted", { description: task.title });
              if (onDeleted) onDeleted();
              else router.push(`/l/${list.id}`);
            },
          });
        }}
      />
    </div>
  );
}

/* ---------- Title ---------- */

function TitleField({ task, editable, large }: { task: Task; editable: boolean; large: boolean }) {
  const update = useUpdateTask();
  const [draft, setDraft] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const cls = cn(
    "w-full font-semibold tracking-[-0.01em] text-fg",
    large ? "text-24 leading-8" : "text-20 leading-7",
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "0px";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement ?? el);
    return () => ro.disconnect();
  }, [draft, task.title]);

  if (!editable) return <h1 className={cls}>{task.title}</h1>;

  function commit() {
    if (draft === null) return;
    const v = draft.replace(/\s+/g, " ").trim();
    setDraft(null);
    if (v && v !== task.title) update.mutate({ task, patch: { title: v }, failure: "Couldn't rename the task" });
  }

  return (
    <>
      <h1 className="sr-only">{task.title}</h1>
      <textarea
        ref={ref}
        aria-label="Task title"
        rows={1}
        maxLength={500}
        value={draft ?? task.title}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
        className={cn(
          cls,
          "-mx-1.5 resize-none overflow-hidden rounded-sm bg-transparent px-1.5 py-0.5 outline-none hover:bg-hover focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-ring",
        )}
      />
    </>
  );
}

/* ---------- Description ---------- */

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

function Description({ detail, editable, people }: { detail: TaskDetailData; editable: boolean; people: UserSummary[] }) {
  // `mutate` is stable across renders, so `flush` is too and the unmount save runs only once.
  const { mutate: saveDescription } = useSaveDescription(detail.task);
  const [state, setState] = useState<SaveState>("idle");
  const latest = useRef<JsonValue | null>(null);
  const timer = useRef<number | null>(null);
  const [editing, setEditing] = useState(false);

  const flush = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    if (latest.current === null) return;
    const doc = latest.current;
    latest.current = null;
    setState("saving");
    saveDescription(isEmptyDoc(doc) ? null : doc, {
      onSuccess: () => setState("saved"),
      onError: (e) => {
        setState("error");
        latest.current = doc;
        toast.error("Couldn't save the description", {
          description: `${errorMessage(e)} Your text is still in the editor; it saves again on your next change.`,
        });
      },
    });
  }, [saveDescription]);

  // Save whatever is pending when the task closes.
  useEffect(() => () => flush(), [flush]);

  if (!editable) {
    return isEmptyDoc(detail.description) ? (
      <p className="text-13 text-fg-faint">No description.</p>
    ) : (
      <RichTextView doc={detail.description} />
    );
  }

  const empty = isEmptyDoc(detail.description);
  if (!editing && empty) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex h-16 w-full items-start rounded-sm px-2 py-2 text-left text-13 text-fg-faint hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring"
      >
        Add details, a checklist, or links. Type @ to mention someone.
      </button>
    );
  }

  return (
    <div className="relative rounded-md border border-border px-3 py-2 focus-within:border-ring">
      <RichTextEditor
        initial={detail.description}
        members={people}
        autofocus={editing && empty}
        placeholder="Add details, a checklist, or links. Type @ to mention someone."
        aria-label="Description"
        onChange={(doc) => {
          latest.current = doc;
          setState("pending");
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(flush, 900);
        }}
        onBlur={flush}
      />
      <p aria-live="polite" className="pointer-events-none absolute right-3 top-2.5 flex items-center gap-1 text-12 text-fg-faint">
        {state === "saving" || state === "pending" ? (
          <>
            <Spinner size={12} label="Saving" /> Saving
          </>
        ) : state === "saved" ? (
          <>
            <Check className="size-3" aria-hidden /> Saved
          </>
        ) : state === "error" ? (
          <span className="text-danger-text">Not saved</span>
        ) : null}
      </p>
    </div>
  );
}

/* ---------- Skeleton ---------- */

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <IconButton label="Close" shortcut={["Esc"]} size="sm" onClick={onClose}>
      <X aria-hidden />
    </IconButton>
  );
}

export function DetailSkeleton({ layout, onClose }: { layout: DetailLayout; onClose?: () => void }) {
  return (
    <div className={cn("flex flex-col", layout === "page" && "mx-auto w-full max-w-[1200px]")}>
      <div className="flex h-11 items-center gap-2 border-b border-border-subtle px-5">
        <Skeleton className="size-2 rounded-full" />
        <Skeleton className="h-3 w-40" />
        <span className="flex-1" />
        {onClose && <CloseButton onClose={onClose} />}
      </div>
      <div role="status" aria-label="Loading task">
      <div className="flex flex-col gap-4 px-5 pt-4">
        <Skeleton className="h-6 w-3/4" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4 w-4/5" />
          ))}
        </div>
        <Skeleton className="mt-4 h-3 w-24" />
        {[92, 86, 60].map((w, i) => (
          <Skeleton key={i} className="h-3" style={{ width: `${w}%` }} />
        ))}
      </div>
      </div>
    </div>
  );
}

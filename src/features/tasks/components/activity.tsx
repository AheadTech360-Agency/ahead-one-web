"use client";

import { format } from "date-fns";
import { CircleAlert, History } from "lucide-react";
import { errorMessage } from "@/lib/api/client";
import type { JsonValue, UserSummary } from "@/lib/api/types";
import { Avatar } from "@/ui/avatar";
import { StatusPill, priorityLabel } from "@/ui/badge";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { Skeleton } from "@/ui/skeleton";
import { useActivity } from "../api";
import { absoluteTime, relativeTime } from "../lib/dates";

type Obj = { [k: string]: JsonValue };
const obj = (v: JsonValue): Obj => (typeof v === "object" && v !== null && !Array.isArray(v) ? v : {});
const str = (v: JsonValue | undefined) => (typeof v === "string" ? v : "");

function dueText(v: JsonValue | undefined): string | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  // Date-only due dates are stored at 23:59 local time; show those without a time.
  const dateOnly = d.getHours() === 23 && d.getMinutes() === 59;
  return format(d, dateOnly ? "MMM d, yyyy" : "MMM d, yyyy, h:mm a");
}

function names(ids: JsonValue | undefined, people: UserSummary[]): string {
  const list = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  const n = list.map((id) => {
    const p = people.find((u) => u.id === id);
    return p ? p.full_name || p.email : "someone";
  });
  if (n.length <= 2) return n.join(" and ");
  return `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
}

const Q = ({ children }: { children: React.ReactNode }) => (
  <span className="font-medium text-fg">&ldquo;{children}&rdquo;</span>
);
const B = ({ children }: { children: React.ReactNode }) => <span className="font-medium text-fg">{children}</span>;

/**
 * One readable sentence per activity kind (without the actor). `taskTitle` adds "on <task>" for
 * feeds that span tasks. Unknown kinds fall back to a neutral sentence.
 */
export function activitySentence(
  kind: string,
  payload: JsonValue,
  people: UserSummary[],
  taskTitle?: string,
): React.ReactNode {
  const p = obj(payload);
  const on = taskTitle ? (
    <>
      {" "}
      on <B>{taskTitle}</B>
    </>
  ) : null;
  const self = taskTitle ? <B>{taskTitle}</B> : "this task";
  switch (kind) {
    case "created":
      return <>created {self}</>;
    case "title_changed":
      return (
        <>
          renamed {taskTitle ? "a task" : "this task"} from <Q>{str(p.from)}</Q> to <Q>{str(p.to)}</Q>
        </>
      );
    case "description_changed":
      return <>updated the description{on}</>;
    case "status_changed": {
      const color = str(p.color) || "var(--fg-faint)";
      return (
        <>
          moved {self} from <StatusPill name={str(p.from)} color="var(--fg-faint)" className="mx-0.5 align-middle" /> to{" "}
          <StatusPill name={str(p.to)} color={color} className="mx-0.5 align-middle" />
        </>
      );
    }
    case "priority_changed": {
      const label = (v: JsonValue | undefined) =>
        v === "urgent" || v === "high" || v === "normal" || v === "low" ? priorityLabel(v) : "None";
      return (
        <>
          changed the priority from <B>{label(p.from)}</B> to <B>{label(p.to)}</B>
          {on}
        </>
      );
    }
    case "due_changed": {
      const from = dueText(p.from);
      const to = dueText(p.to);
      if (!to) return <>cleared the due date{on}</>;
      if (!from) return <>set the due date to <B>{to}</B>{on}</>;
      return (
        <>
          moved the due date from <B>{from}</B> to <B>{to}</B>
          {on}
        </>
      );
    }
    case "assignees_changed": {
      const added = names(p.added, people);
      const removed = names(p.removed, people);
      if (added && removed)
        return (
          <>
            assigned <B>{added}</B> and unassigned <B>{removed}</B>
            {on}
          </>
        );
      if (added) return <>assigned <B>{added}</B>{on}</>;
      if (removed) return <>unassigned <B>{removed}</B>{on}</>;
      return <>changed the assignees{on}</>;
    }
    case "moved":
      return (
        <>
          moved {self} from <B>{str(p.from)}</B> to <B>{str(p.to)}</B>
        </>
      );
    case "attachment_added":
      return <>attached <B>{str(p.filename) || "a file"}</B>{on}</>;
    case "attachment_removed":
      return <>removed the file <B>{str(p.filename) || "a file"}</B>{on}</>;
    case "commented":
      return <>commented{on}</>;
    case "comment_deleted":
      return <>deleted a comment{on}</>;
    case "subtask_added":
      return <>added the subtask <Q>{str(p.title)}</Q>{on}</>;
    case "deleted":
      return <>deleted {self}</>;
    default:
      return <>updated {self}</>;
  }
}

export function ActivityList({ taskId, people }: { taskId: string; people: UserSummary[] }) {
  const q = useActivity(taskId);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  if (q.isPending) {
    return (
      <div role="status" aria-label="Loading activity" className="flex flex-col gap-4 py-3">
        {[70, 52, 64].map((w, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-3" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    );
  }
  if (q.isError) {
    return (
      <EmptyState
        compact
        tone="danger"
        icon={CircleAlert}
        title="Activity didn't load"
        description={errorMessage(q.error)}
        action={<Button size="sm" onClick={() => void q.refetch()}>Try again</Button>}
      />
    );
  }
  if (items.length === 0) {
    return <EmptyState compact icon={History} title="No activity yet" description="Changes to this task are recorded here." />;
  }
  return (
    <div className="flex flex-col">
      <ol className="relative flex flex-col gap-3 py-3 before:absolute before:bottom-4 before:left-[9px] before:top-4 before:w-px before:bg-border">
        {items.map((a) => (
          <li key={a.id} className="relative flex items-start gap-2.5 text-13 leading-5 text-fg-muted">
            {a.actor ? (
              <Avatar user={a.actor} size="xs" decorative className="mt-px ring-2 ring-surface-raised" />
            ) : (
              <span className="mt-px size-5 shrink-0 rounded-full bg-active ring-2 ring-surface-raised" aria-hidden />
            )}
            <p className="min-w-0 flex-1">
              <B>{a.actor ? a.actor.full_name || a.actor.email : "Someone"}</B>{" "}
              {activitySentence(a.kind, a.payload, people)}
              <time dateTime={a.created_at} title={absoluteTime(a.created_at)} className="ml-1.5 whitespace-nowrap text-12 text-fg-faint">
                {relativeTime(a.created_at)}
              </time>
            </p>
          </li>
        ))}
      </ol>
      {q.hasNextPage && (
        <Button size="sm" variant="ghost" className="self-start" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
          Show older activity
        </Button>
      )}
    </div>
  );
}

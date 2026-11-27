"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { usePersonal } from "@/features/personal/api";
import { showsLockBadge } from "@/features/personal/logic";
import type { ActivityFeedItem, MentionItem, MyTask, UserSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarStack } from "@/ui/avatar";
import { PriorityBadge } from "@/ui/badge";
import { DUE_TONE_CLASS, absoluteTime, dueTone, formatDue, relativeTime } from "../lib/dates";
import { intent, usePrefetchers } from "@/lib/api/prefetch";
import { useTaskLink } from "../lib/use-task-filters";
import { activitySentence } from "./activity";

/** A task from My Tasks or the dashboard: status dot, title, where it lives, when it's due. */
export function MyTaskRow({ item, card = false }: { item: MyTask; card?: boolean }) {
  const link = useTaskLink();
  const pf = usePrefetchers();
  const { ids } = usePersonal();
  const t = item.task;
  const tone = dueTone(t);
  const isPrivate = showsLockBadge(t.project_id, ids);
  return (
    <li>
      <Link
        href={link.href(t.id)}
        scroll={false}
        {...intent(() => pf.task(t.id))}
        className={cn(
          "group/r flex min-h-12 items-center gap-3 px-3 py-2 outline-none transition-colors duration-[var(--dur-fast)]",
          "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
          card ? "rounded-md border border-border bg-surface hover:border-border-strong" : "hover:bg-surface-sunken",
        )}
      >
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ boxShadow: `inset 0 0 0 2px ${item.status_color}` }}
          title={item.status_name}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-13 font-medium text-fg group-hover/r:underline group-hover/r:decoration-fg-faint">{t.title}</span>
          <span className="block truncate text-12 text-fg-muted">
            {isPrivate ? (
              <span className="inline-flex items-center gap-1">
                <Lock className="size-3 shrink-0" aria-hidden />
                <span>Private</span>
                <span className="sr-only">, only you can see this task</span>
              </span>
            ) : (
              <>
                {item.project_name} <span className="text-fg-faint">/</span> {item.list_name}
              </>
            )}
            <span className="sr-only">, status {item.status_name}</span>
          </span>
        </span>
        {(t.priority === "urgent" || t.priority === "high") && <PriorityBadge priority={t.priority} iconOnly />}
        {t.due_at && (
          <span className={cn("min-w-[72px] shrink-0 whitespace-nowrap text-right text-12 tabular", DUE_TONE_CLASS[tone], tone === "overdue" && "font-medium")}>
            {formatDue(t)}
          </span>
        )}
        {t.assignees.length > 1 && <AvatarStack users={t.assignees} size="xs" max={3} className="hidden sm:flex" />}
      </Link>
    </li>
  );
}

export function FeedItem({ item, people }: { item: ActivityFeedItem; people: UserSummary[] }) {
  const link = useTaskLink();
  return (
    <li className="flex gap-2.5 py-2">
      {item.actor ? <Avatar user={item.actor} size="xs" decorative className="mt-0.5" /> : <span className="mt-0.5 size-5 shrink-0 rounded-full bg-active" aria-hidden />}
      <div className="min-w-0 flex-1 text-13 leading-5 text-fg-muted">
        <Link href={link.href(item.task_id)} scroll={false} className="rounded-xs hover:text-fg focus-visible:outline-2 focus-visible:outline-ring">
          <span className="font-medium text-fg">{item.actor ? item.actor.full_name || item.actor.email : "Someone"}</span>{" "}
          {activitySentence(item.kind, item.payload, people, item.task_title)}
        </Link>
        <p className="text-12 text-fg-faint">
          {item.project_name},{" "}
          <time dateTime={item.created_at} title={absoluteTime(item.created_at)}>
            {relativeTime(item.created_at)}
          </time>
        </p>
      </div>
    </li>
  );
}

export function MentionRow({ item }: { item: MentionItem }) {
  const link = useTaskLink();
  const href = item.task_id ? link.href(item.task_id) : item.conversation_id ? `/messages/${item.conversation_id}` : null;
  const body = (
    <>
      {item.actor ? <Avatar user={item.actor} size="xs" decorative className="mt-0.5" /> : <span className="mt-0.5 size-5 shrink-0 rounded-full bg-active" aria-hidden />}
      <span className="min-w-0 flex-1">
        <span className="block text-12 text-fg-muted">
          <span className="font-medium text-fg">{item.actor?.full_name.split(" ")[0] ?? "Someone"}</span>{" "}
          {item.source_type === "message" ? "in a conversation" : "on a task"}, {relativeTime(item.created_at)}
        </span>
        <span className="line-clamp-2 text-13 text-fg">{item.excerpt}</span>
      </span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link
          href={href}
          scroll={false}
          className="flex gap-2.5 rounded-sm px-2 py-2 hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
        >
          {body}
        </Link>
      ) : (
        <div className="flex gap-2.5 px-2 py-2">{body}</div>
      )}
    </li>
  );
}

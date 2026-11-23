"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Hash, Lock, RotateCw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { errorMessage } from "@/lib/api/client";
import { useConversations } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { Avatar } from "@/ui/avatar";
import { Skeleton } from "@/ui/skeleton";

export function ConversationsPane() {
  const pathname = usePathname();
  const { workspaceId, me } = useWorkspace();
  const q = useConversations(workspaceId);
  const isIndex = pathname === "/messages";

  return (
    <aside
      aria-label="Conversations"
      className={cn(
        "min-h-0 flex-col border-border-subtle md:flex md:border-r",
        isIndex ? "flex" : "hidden",
      )}
    >
      <div className="flex h-12 shrink-0 items-center border-b border-border-subtle px-4">
        <h1 className="text-14 font-semibold">Messages</h1>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {q.isPending && workspaceId ? (
          <div className="flex flex-col" role="status" aria-label="Loading conversations">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-2.5 py-2.5" aria-hidden>
                <Skeleton className="size-7 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-36" />
                </div>
              </div>
            ))}
          </div>
        ) : q.isError || !workspaceId || !q.data ? (
          <div className="px-3 py-6 text-13 text-fg-muted">
            <p>Couldn&apos;t load conversations.</p>
            <p className="mt-0.5 text-12">{q.error ? errorMessage(q.error) : "Your workspace hasn't loaded."}</p>
            {workspaceId && (
              <button
                type="button"
                onClick={() => q.refetch()}
                className="mt-2 inline-flex items-center gap-1 text-13 font-medium text-fg hover:underline focus-visible:outline-2 focus-visible:outline-ring"
              >
                <RotateCw className="size-3.5" aria-hidden /> Retry
              </button>
            )}
          </div>
        ) : q.data.length === 0 ? (
          <p className="px-3 py-6 text-13 text-fg-muted">
            No conversations yet. Channels you join and direct messages appear here.
          </p>
        ) : (
          <ul className="flex flex-col gap-px">
            {q.data.map((c) => {
              const other = c.kind === "dm" ? c.members.find((m) => m.id !== me?.user.id) ?? c.members[0] : undefined;
              const name = c.kind === "dm" ? other?.full_name || other?.email || "Direct message" : `${c.name ?? "channel"}`;
              const href = `/messages/${c.id}`;
              const active = pathname === href;
              return (
                <li key={c.id}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-sm px-2.5 py-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                      active ? "bg-active" : "hover:bg-hover",
                    )}
                  >
                    {other ? (
                      <Avatar user={other} size="sm" decorative className="size-7" />
                    ) : (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-active text-fg-muted">
                        {c.is_private ? <Lock className="size-3.5" aria-hidden /> : <Hash className="size-3.5" aria-hidden />}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-13", c.unread_count ? "font-semibold text-fg" : "text-fg")}>
                          {name}
                        </span>
                        {c.last_message && (
                          <span className="shrink-0 text-11 text-fg-faint">
                            {formatDistanceToNowStrict(new Date(c.last_message.created_at))}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-12 text-fg-muted">
                        {c.last_message
                          ? c.last_message.deleted
                            ? "Message deleted"
                            : c.last_message.body
                          : c.topic ?? "No messages yet"}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

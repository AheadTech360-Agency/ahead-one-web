"use client";

import { Check, CheckCheck } from "lucide-react";
import type { UserSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { displayName } from "./format";

/** DM: one tick when sent, two coloured ticks once the other person has read it. */
export function DmTicks({ state, className }: { state: "sent" | "seen"; className?: string }) {
  const Icon = state === "seen" ? CheckCheck : Check;
  return (
    <span
      role="img"
      aria-label={state === "seen" ? "Seen" : "Sent"}
      title={state === "seen" ? "Seen" : "Sent"}
      className={cn("inline-flex shrink-0 items-center transition-colors duration-[var(--dur-base)]", state === "seen" ? "text-accent-text" : "text-fg-faint", className)}
    >
      <Icon className="size-3.5" strokeWidth={2} aria-hidden />
    </span>
  );
}

/** Channel: "Seen by N" with a popover listing who has read the sender's latest message. */
export function SeenBy({ readers, className }: { readers: UserSummary[]; className?: string }) {
  if (readers.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Seen by ${readers.length}. Show who`}
        className={cn(
          "mt-1 inline-flex h-6 items-center gap-1.5 rounded-sm px-1.5 text-11 font-medium text-fg-muted outline-none hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring",
          className,
        )}
      >
        <CheckCheck className="size-3.5 text-accent-text" aria-hidden />
        Seen by {readers.length}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <p className="px-2.5 pb-1 pt-1.5 text-11 font-medium uppercase tracking-[0.06em] text-fg-faint">Seen by</p>
        <ul className="m-0 max-h-64 list-none overflow-y-auto p-0">
          {readers.map((u) => (
            <li key={u.id} className="flex items-center gap-2.5 rounded-sm px-2.5 py-1.5">
              <Avatar user={u} size="sm" decorative />
              <span className="min-w-0 truncate text-13 text-fg">{displayName(u)}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

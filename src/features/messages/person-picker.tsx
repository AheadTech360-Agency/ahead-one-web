"use client";

import { Command } from "cmdk";
import { Search } from "lucide-react";
import type { UserSummary } from "@/lib/api/types";
import { Avatar } from "@/ui/avatar";
import { Spinner } from "@/ui/spinner";
import { displayName } from "./format";

/**
 * Inline searchable list of people (cmdk): type to filter, arrows to move, Enter to pick.
 * Used to start a DM and to add channel members.
 */
export function PersonList({
  people,
  onPick,
  busyId,
  label,
  empty,
  autoFocus = true,
  trailing,
}: {
  people: UserSummary[];
  onPick: (u: UserSummary) => void;
  busyId?: string | null;
  label: string;
  empty: string;
  autoFocus?: boolean;
  trailing?: (u: UserSummary) => React.ReactNode;
}) {
  return (
    <Command loop label={label} className="flex min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border-subtle px-3">
        <Search className="size-4 text-fg-faint" aria-hidden />
        <Command.Input
          autoFocus={autoFocus}
          placeholder="Search by name or email"
          className="h-full flex-1 bg-transparent text-13 text-fg outline-none placeholder:text-fg-faint"
        />
      </div>
      <Command.List className="max-h-80 min-h-0 overflow-y-auto p-1">
        <Command.Empty className="px-3 py-8 text-center text-13 text-fg-muted">{empty}</Command.Empty>
        {people.map((u) => (
          <Command.Item
            key={u.id}
            value={`${displayName(u)} ${u.email} ${u.id}`}
            onSelect={() => onPick(u)}
            disabled={Boolean(busyId)}
            className="flex h-11 cursor-default items-center gap-2.5 rounded-xs px-2 text-13 outline-none data-[disabled=true]:opacity-60 data-[selected=true]:bg-hover"
          >
            <Avatar user={u} size="md" decorative />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-fg">{displayName(u)}</span>
              {u.full_name && <span className="block truncate text-12 text-fg-muted">{u.email}</span>}
            </span>
            {busyId === u.id ? <Spinner size={14} label="Working" /> : trailing?.(u)}
          </Command.Item>
        ))}
      </Command.List>
    </Command>
  );
}

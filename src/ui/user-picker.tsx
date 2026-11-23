"use client";

import { Command } from "cmdk";
import { Check, Search, UserPlus } from "lucide-react";
import { useState } from "react";
import type { UserSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarStack } from "./avatar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/**
 * Multi-select people picker. Type to filter, arrows to move, Enter or Space to toggle.
 * Selected people sort to the top when the popover opens.
 */
export function UserPicker({
  users,
  value,
  onChange,
  placeholder = "Assign",
  className,
  "aria-label": ariaLabel = "Assignees",
}: {
  users: UserSummary[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const selected = users.filter((u) => value.includes(u.id));

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  function onOpenChange(next: boolean) {
    if (next) {
      // Freeze the order while open so rows don't jump under the pointer.
      setOrder([
        ...users.filter((u) => value.includes(u.id)).map((u) => u.id),
        ...users.filter((u) => !value.includes(u.id)).map((u) => u.id),
      ]);
    }
    setOpen(next);
  }

  const ordered = order.length
    ? order.map((id) => users.find((u) => u.id === id)).filter((u): u is UserSummary => Boolean(u))
    : users;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            selected.length
              ? `${ariaLabel}: ${selected.map((u) => u.full_name || u.email).join(", ")}`
              : ariaLabel
          }
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-sm border border-border-strong bg-surface px-2 text-13",
            "hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:border-ring",
            className,
          )}
        >
          {selected.length ? (
            <>
              <AvatarStack users={selected} size="xs" max={3} />
              <span className="truncate text-fg">
                {selected.length === 1 ? selected[0].full_name || selected[0].email : `${selected.length} people`}
              </span>
            </>
          ) : (
            <>
              <UserPlus className="size-4 text-fg-faint" aria-hidden />
              <span className="text-fg-faint">{placeholder}</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command loop className="flex flex-col" label={ariaLabel}>
          <div className="flex h-9 items-center gap-2 border-b border-border-subtle px-2.5">
            <Search className="size-4 text-fg-faint" aria-hidden />
            <Command.Input
              placeholder="Search people"
              className="h-full flex-1 bg-transparent text-13 text-fg outline-none placeholder:text-fg-faint"
            />
          </div>
          <Command.List className="max-h-64 overflow-y-auto p-1">
            <Command.Empty className="px-2 py-6 text-center text-13 text-fg-muted">
              No one matches that name.
            </Command.Empty>
            {ordered.map((u) => {
              const on = value.includes(u.id);
              return (
                <Command.Item
                  key={u.id}
                  value={`${u.full_name} ${u.email} ${u.id}`}
                  onSelect={() => toggle(u.id)}
                  data-checked={on || undefined}
                  className="flex h-9 cursor-default items-center gap-2 rounded-xs px-2 text-13 outline-none data-[selected=true]:bg-hover"
                >
                  <Avatar user={u} size="sm" decorative />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-fg">{u.full_name || u.email}</span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 items-center justify-center rounded-xs border",
                      on ? "border-accent bg-accent text-fg-on-accent" : "border-border-strong",
                    )}
                  >
                    {on && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="sr-only">{on ? "selected" : "not selected"}</span>
                </Command.Item>
              );
            })}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

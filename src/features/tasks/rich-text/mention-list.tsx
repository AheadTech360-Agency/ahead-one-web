"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import type { UserSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";

export type MentionListHandle = { onKeyDown: (e: KeyboardEvent) => boolean };

/** The @ suggestion list. Arrows move, Enter or Tab inserts, Escape closes (handled by Tiptap). */
export const MentionList = forwardRef<
  MentionListHandle,
  { items: UserSummary[]; command: (attrs: { id: string; label: string }) => void }
>(function MentionList({ items, command }, ref) {
  const [index, setIndex] = useState(0);
  const [prevItems, setPrevItems] = useState(items);
  if (prevItems !== items) {
    setPrevItems(items);
    setIndex(0);
  }

  function pick(i: number) {
    const u = items[i];
    if (u) command({ id: u.id, label: u.full_name || u.email });
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: (e) => {
      if (!items.length) return false;
      if (e.key === "ArrowDown") {
        setIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        setIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        pick(index);
        return true;
      }
      return false;
    },
  }));

  return (
    <div
      role="listbox"
      aria-label="Mention someone"
      className="w-64 overflow-hidden rounded-md border border-border bg-surface-raised p-1 text-13 shadow-popover animate-in-pop"
    >
      {items.length === 0 ? (
        <p className="px-2 py-2 text-fg-muted">No one by that name in this workspace.</p>
      ) : (
        items.map((u, i) => (
          <button
            key={u.id}
            type="button"
            role="option"
            aria-selected={i === index}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setIndex(i)}
            onClick={() => pick(i)}
            className={cn(
              "flex h-8 w-full items-center gap-2 rounded-xs px-2 text-left text-fg",
              i === index && "bg-hover",
            )}
          >
            <Avatar user={u} size="xs" decorative />
            <span className="min-w-0 flex-1 truncate">{u.full_name || u.email}</span>
          </button>
        ))
      )}
    </div>
  );
});

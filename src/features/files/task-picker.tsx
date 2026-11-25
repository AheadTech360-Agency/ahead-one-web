"use client";

import { CheckSquare, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { TaskHit } from "@/lib/api/types";
import { useWorkspace } from "@/lib/workspace";
import { Input } from "@/ui/input";
import { Spinner } from "@/ui/spinner";
import { useSearch } from "../tasks/api";

/** Search tasks by title and pick one. Used to attach a recording to a task. */
export function TaskPicker({ onPick, disabled, autoFocus }: { onPick: (t: TaskHit) => void; disabled?: boolean; autoFocus?: boolean }) {
  const { workspaceId } = useWorkspace();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => setQ(text.trim()), 250);
    return () => window.clearTimeout(id);
  }, [text]);
  const search = useSearch(workspaceId, q);
  const tasks = search.data?.tasks ?? [];

  return (
    <div className="flex flex-col gap-2">
      <Input
        aria-label="Search tasks"
        placeholder="Search tasks by title"
        leading={<Search aria-hidden />}
        value={text}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
      />
      <div aria-live="polite" className="max-h-52 overflow-y-auto rounded-sm border border-border-subtle">
        {q.length < 2 ? (
          <p className="px-3 py-4 text-13 text-fg-muted">Type at least two letters of a task title.</p>
        ) : search.isFetching && !search.data ? (
          <p className="flex items-center gap-2 px-3 py-4 text-13 text-fg-muted">
            <Spinner label="Searching" /> Searching
          </p>
        ) : search.isError ? (
          <p className="px-3 py-4 text-13 text-danger-text">Search didn&apos;t load. Try again.</p>
        ) : tasks.length === 0 ? (
          <p className="px-3 py-4 text-13 text-fg-muted">No tasks match &ldquo;{q}&rdquo;.</p>
        ) : (
          <ul>
            {tasks.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(t)}
                  className="flex min-h-10 w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring disabled:opacity-50"
                >
                  <CheckSquare className="size-4 shrink-0 text-fg-faint" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-13 text-fg">{t.title}</span>
                    <span className="block truncate text-12 text-fg-muted">{t.project_name}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

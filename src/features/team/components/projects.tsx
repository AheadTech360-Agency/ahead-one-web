"use client";

import { Check, ChevronsUpDown, FolderKanban } from "lucide-react";
import { useState } from "react";
import { intent, usePrefetchers } from "@/lib/api/prefetch";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/ui/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import type { ProjectScopeRow } from "../lib/logic";
import { ClientDot } from "./primitives";

export type ClientScope = "client" | "project";

/* ---------- Second level of "Per client": Whole client | Per project ---------- */

export function ScopeSwitch({ value, onChange, disabled }: { value: ClientScope; onChange: (v: ClientScope) => void; disabled?: boolean }) {
  const opts: { id: ClientScope; label: string }[] = [
    { id: "client", label: "Whole client" },
    { id: "project", label: "Per project" },
  ];
  return (
    <div role="radiogroup" aria-label="Client scope" className="inline-flex rounded-md bg-band-line/40 p-0.5">
      {opts.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled && o.id === "project"}
            onClick={() => onChange(o.id)}
            className={cn(
              "h-8 rounded-[3px] px-3.5 text-13 font-medium outline-none transition-colors duration-[var(--dur-fast)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-band-fg disabled:opacity-40",
              on ? "bg-band-fg text-navy-deep shadow-xs" : "text-band-strong hover:bg-band-line/50",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Project picker (listbox in a popover) ---------- */

export function ProjectPicker({
  spaceId,
  projects,
  value,
  onChange,
}: {
  spaceId: string;
  projects: ProjectScopeRow[];
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pf = usePrefetchers();
  const current = projects.find((p) => p.project_id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Choose a project"
        className="inline-flex h-8 min-w-[200px] items-center gap-2 rounded-md border border-band-line bg-band-line/30 px-3 text-13 font-medium text-band-fg outline-none transition-colors hover:bg-band-line/50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-band-fg data-[state=open]:bg-band-line/50"
      >
        {current ? <ClientDot color={current.color} /> : <FolderKanban className="size-3.5 text-band-muted" aria-hidden />}
        <span className="min-w-0 flex-1 truncate text-left">{current?.name ?? "Choose a project"}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-band-muted" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-1">
        {projects.length === 0 ? (
          <EmptyState compact icon={FolderKanban} title="No projects yet" description="This client has no active projects." />
        ) : (
          <ul role="listbox" aria-label="Projects" className="m-0 max-h-[320px] list-none overflow-y-auto p-0">
            {projects.map((p) => {
              const on = p.project_id === value;
              return (
                <li key={p.project_id} role="option" aria-selected={on}>
                  <button
                    type="button"
                    {...intent(() => pf.teamProject(spaceId, p.project_id))}
                    onClick={() => {
                      onChange(p.project_id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left outline-none hover:bg-hover focus-visible:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <ClientDot color={p.color} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-13 font-medium text-fg">{p.name}</span>
                      <span className="block text-12 tabular text-fg-muted">
                        {p.open} open
                        {p.overdue > 0 && <span className="text-danger-text"> / {p.overdue} overdue</span>}
                      </span>
                    </span>
                    {on && <Check className="size-4 text-accent-text" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ---------- Projects strip: jump between a client's projects ---------- */

export function ProjectStrip({
  spaceId,
  projects,
  value,
  onPick,
}: {
  spaceId: string;
  projects: ProjectScopeRow[];
  value: string | undefined;
  onPick: (id: string | undefined) => void;
}) {
  const pf = usePrefetchers();
  if (projects.length === 0) return null;
  return (
    <nav aria-label="Projects of this client" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="m-0 flex w-max list-none gap-2 p-0 pb-1 sm:w-auto sm:flex-wrap">
        <li>
          <Chip on={value === undefined} onClick={() => onPick(undefined)} {...intent(() => pf.teamClient(spaceId))}>
            Whole client
          </Chip>
        </li>
        {projects.map((p) => (
          <li key={p.project_id}>
            <Chip on={p.project_id === value} onClick={() => onPick(p.project_id)} {...intent(() => pf.teamProject(spaceId, p.project_id))}>
              <ClientDot color={p.color} />
              <span className="max-w-[160px] truncate">{p.name}</span>
              <span className={cn("text-12 tabular", p.project_id === value ? "opacity-80" : "text-fg-muted")}>{p.open}</span>
              {p.overdue > 0 && (
                <span
                  aria-label={`${p.overdue} overdue`}
                  className={cn("rounded-full px-1.5 text-11 font-semibold leading-4 tabular", p.project_id === value ? "bg-fg-on-accent/20 text-fg-on-accent" : "bg-danger-subtle text-danger-text")}
                >
                  {p.overdue}
                </span>
              )}
            </Chip>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Chip({ on, children, ...props }: { on: boolean; children: React.ReactNode } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-13 font-medium outline-none transition-colors duration-[var(--dur-fast)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        on ? "border-accent bg-accent text-fg-on-accent" : "border-border bg-surface text-fg hover:bg-hover",
      )}
      {...props}
    >
      {children}
    </button>
  );
}

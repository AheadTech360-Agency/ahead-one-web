"use client";

import { Check, ChevronsUpDown, Layers } from "lucide-react";
import { useState } from "react";
import { intent, usePrefetchers } from "@/lib/api/prefetch";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/ui/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import type { ClientSummary } from "@/lib/api/types";
import { formatCount } from "../lib/logic";
import { ClientDot } from "./primitives";

/* ---------- Segmented control: Complete view | Per client ---------- */

export function ViewSwitch({
  mode,
  onChange,
  disabled,
}: {
  mode: "complete" | "client";
  onChange: (m: "complete" | "client") => void;
  disabled?: boolean;
}) {
  const opts: { id: "complete" | "client"; label: string }[] = [
    { id: "complete", label: "Complete view" },
    { id: "client", label: "Per client" },
  ];
  return (
    <div role="radiogroup" aria-label="Dashboard view" className="inline-flex rounded-md bg-band-line/40 p-0.5">
      {opts.map((o) => {
        const on = mode === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled && o.id === "client"}
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

/* ---------- Client picker (listbox in a popover) ---------- */

export function ClientPicker({
  clients,
  value,
  onChange,
}: {
  clients: ClientSummary[];
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pf = usePrefetchers();
  const current = clients.find((c) => c.space_id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Choose a client"
        className="inline-flex h-8 min-w-[200px] items-center gap-2 rounded-md border border-band-line bg-band-line/30 px-3 text-13 font-medium text-band-fg outline-none transition-colors hover:bg-band-line/50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-band-fg data-[state=open]:bg-band-line/50"
      >
        {current ? <ClientDot color={current.color} /> : <Layers className="size-3.5 text-band-muted" aria-hidden />}
        <span className="min-w-0 flex-1 truncate text-left">{current?.name ?? "Choose a client"}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-band-muted" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-1">
        {clients.length === 0 ? (
          <EmptyState compact icon={Layers} title="No clients yet" description="Clients are spaces. Create one from the sidebar." />
        ) : (
          <ul role="listbox" aria-label="Clients" className="m-0 max-h-[320px] list-none overflow-y-auto p-0">
            {clients.map((c) => {
              const on = c.space_id === value;
              return (
                <li key={c.space_id} role="option" aria-selected={on}>
                  <button
                    type="button"
                    {...intent(() => pf.teamClient(c.space_id))}
                    onClick={() => {
                      onChange(c.space_id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left outline-none hover:bg-hover focus-visible:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <ClientDot color={c.color} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-13 font-medium text-fg">{c.name}</span>
                      <span className="block text-12 tabular text-fg-muted">
                        {c.open} open
                        {c.overdue > 0 && <span className="text-danger-text"> / {c.overdue} overdue</span>}
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

/* ---------- Clients strip: jump between clients ---------- */

export function ClientStrip({
  clients,
  value,
  onPick,
}: {
  clients: ClientSummary[];
  value: string | undefined;
  onPick: (id: string | undefined) => void;
}) {
  const pf = usePrefetchers();
  if (clients.length === 0) return null;
  return (
    <nav aria-label="Clients" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="m-0 flex w-max list-none gap-2 p-0 pb-1 sm:w-auto sm:flex-wrap">
        <li>
          <StripChip on={value === undefined} onClick={() => onPick(undefined)} {...intent(() => pf.teamClient(undefined))}>
            All clients
          </StripChip>
        </li>
        {clients.map((c) => (
          <li key={c.space_id}>
            <StripChip on={c.space_id === value} onClick={() => onPick(c.space_id)} {...intent(() => pf.teamClient(c.space_id))}>
              <ClientDot color={c.color} />
              <span className="max-w-[140px] truncate">{c.name}</span>
              {c.overdue > 0 && <span className="rounded-full bg-danger-subtle px-1.5 text-11 font-semibold leading-4 text-danger-text tabular">{c.overdue}</span>}
            </StripChip>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function StripChip({ on, children, ...props }: { on: boolean; children: React.ReactNode } & React.ComponentProps<"button">) {
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

/* ---------- Owner: clients overview ---------- */

export function ClientCards({ clients, onOpen }: { clients: ClientSummary[]; onOpen: (id: string) => void }) {
  const pf = usePrefetchers();
  if (clients.length === 0) {
    return <EmptyState compact icon={Layers} title="No clients yet" description="A client is a space. Create one from the sidebar and it shows here." />;
  }
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {clients.map((c) => (
        <li key={c.space_id}>
          <button
            type="button"
            onClick={() => onOpen(c.space_id)}
            {...intent(() => pf.teamClient(c.space_id))}
            aria-label={`Open ${c.name}: ${c.open} open, ${c.overdue} overdue`}
            className="group relative flex w-full flex-col gap-4 overflow-hidden rounded-md border border-border bg-surface p-4 text-left outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] hover:border-border-strong hover:shadow-[3px_3px_0_0_var(--green)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: c.color }} />
            <span className="flex items-baseline justify-between gap-3 pl-1">
              <span className="truncate text-14 font-semibold text-fg">{c.name}</span>
              <span className="shrink-0 text-12 tabular text-fg-muted">
                {c.projects} {c.projects === 1 ? "project" : "projects"}
              </span>
            </span>
            <span className="grid grid-cols-3 gap-2 pl-1">
              <Stat label="Open" value={c.open} />
              <Stat label="Overdue" value={c.overdue} tone={c.overdue > 0 ? "danger" : undefined} />
              <Stat label="Done 7d" value={c.done_7d} tone={c.done_7d > 0 ? "good" : undefined} />
            </span>
            <span className="pl-1 text-12 text-fg-muted tabular">
              {c.members} {c.members === 1 ? "member" : "members"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" | "good" }) {
  return (
    <span className="block">
      <span className="block text-11 text-fg-muted">{label}</span>
      <span
        className={cn(
          "figure block text-[24px] font-medium leading-7 tracking-[-0.02em] tabular",
          tone === "danger" ? "text-danger-text" : tone === "good" ? "text-success-text" : value === 0 ? "text-fg-faint" : "text-fg",
        )}
      >
        {formatCount(value)}
      </span>
    </span>
  );
}

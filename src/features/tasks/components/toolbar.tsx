"use client";

import { format, parseISO } from "date-fns";
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  CalendarDays,
  CircleDashed,
  Flag,
  KanbanSquare,
  List as ListIcon,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";
import type { Priority, UserSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { PRIORITIES, PriorityBadge, StatusPill } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Calendar } from "@/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { Tooltip } from "@/ui/tooltip";
import type { StatusGroup } from "../lib/groups";
import { SORTS, dayParam, type FilterState } from "../lib/use-task-filters";

export type ViewKind = "list" | "board" | "calendar";

const VIEWS: { value: ViewKind; label: string; icon: typeof ListIcon; key: string }[] = [
  { value: "list", label: "List", icon: ListIcon, key: "1" },
  { value: "board", label: "Board", icon: KanbanSquare, key: "2" },
  { value: "calendar", label: "Calendar", icon: CalendarDays, key: "3" },
];

/** Segmented switcher. Labels show from sm up; below that the icons keep their names. */
export function ViewSwitcher({ value, onChange }: { value: ViewKind; onChange: (v: ViewKind) => void }) {
  return (
    <div role="radiogroup" aria-label="View" className="inline-flex h-8 items-center rounded-sm bg-surface-sunken p-0.5">
      {VIEWS.map((v) => {
        const on = value === v.value;
        return (
          <Tooltip key={v.value} content={`${v.label} view`} shortcut={["Alt", v.key]}>
            <button
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={v.label}
              onClick={() => onChange(v.value)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-xs px-2 text-13 font-medium transition-colors duration-[var(--dur-fast)]",
                "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring [&_svg]:size-4",
                on ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg",
              )}
            >
              <v.icon aria-hidden strokeWidth={1.75} />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

const chip =
  "inline-flex h-7 items-center gap-1.5 rounded-sm border px-2 text-12 font-medium transition-colors duration-[var(--dur-fast)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:border-ring [&_svg]:size-3.5";
const chipOff = "border-dashed border-border-strong text-fg-muted hover:bg-hover hover:text-fg";
const chipOn = "border-border-strong bg-surface text-fg hover:bg-surface-sunken";

function summary(names: string[], noun: string) {
  if (names.length === 0) return noun;
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

export function FiltersBar({
  state,
  update,
  clear,
  activeCount,
  groups,
  people,
  meId,
  showSort = true,
}: {
  state: FilterState;
  update: (p: Partial<FilterState>) => void;
  clear: () => void;
  activeCount: number;
  groups: StatusGroup[];
  people: UserSummary[];
  meId: string | undefined;
  showSort?: boolean;
}) {
  const toggle = <T extends string>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const assigneeNames = state.assignee.map((id) =>
    id === "me" || id === meId ? "Me" : (people.find((p) => p.id === id)?.full_name.split(" ")[0] ?? "Someone"),
  );
  const selectedGroups = groups.filter((g) => g.statusIds.some((id) => state.status.includes(id)));
  const dueText =
    state.dueFrom && state.dueTo
      ? `${format(parseISO(state.dueFrom), "MMM d")} to ${format(parseISO(state.dueTo), "MMM d")}`
      : state.dueFrom
        ? `From ${format(parseISO(state.dueFrom), "MMM d")}`
        : state.dueTo
          ? `Until ${format(parseISO(state.dueTo), "MMM d")}`
          : "Due date";
  const sortLabel = SORTS.find((s) => s.value === state.sort)?.label ?? "Manual order";

  return (
    <div
      className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0"
      role="group"
      aria-label="Filters"
    >
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(chip, state.assignee.length ? chipOn : chipOff)}>
          <User aria-hidden /> {summary(assigneeNames, "Assignee")}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-80 min-w-56 overflow-y-auto">
          <DropdownMenuCheckboxItem
            checked={state.assignee.includes("me")}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => update({ assignee: toggle(state.assignee, "me") })}
          >
            <User aria-hidden /> Me
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {people
            .filter((p) => p.id !== meId)
            .map((p) => (
              <DropdownMenuCheckboxItem
                key={p.id}
                checked={state.assignee.includes(p.id)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => update({ assignee: toggle(state.assignee, p.id) })}
              >
                <Avatar user={p} size="xs" decorative />
                <span className="truncate">{p.full_name || p.email}</span>
              </DropdownMenuCheckboxItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className={cn(chip, selectedGroups.length ? chipOn : chipOff)}>
          <CircleDashed aria-hidden /> {summary(selectedGroups.map((g) => g.name), "Status")}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-52">
          {groups.map((g) => {
            const on = g.statusIds.some((id) => state.status.includes(id));
            return (
              <DropdownMenuCheckboxItem
                key={g.key}
                checked={on}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() =>
                  update({
                    status: on
                      ? state.status.filter((id) => !g.statusIds.includes(id))
                      : [...state.status, ...g.statusIds],
                  })
                }
              >
                <StatusPill name={g.name} color={g.color} category={g.category} />
              </DropdownMenuCheckboxItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={state.hideDone}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(v) => update({ hideDone: v === true })}
          >
            Hide completed tasks
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className={cn(chip, state.priority.length ? chipOn : chipOff)}>
          <Flag aria-hidden /> {summary(state.priority.map((p) => p[0].toUpperCase() + p.slice(1)), "Priority")}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-40">
          {PRIORITIES.map((p) => (
            <DropdownMenuCheckboxItem
              key={p}
              checked={state.priority.includes(p)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => update({ priority: toggle<Priority>(state.priority, p) })}
            >
              <PriorityBadge priority={p} className="text-13 text-fg" />
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover>
        <PopoverTrigger className={cn(chip, state.dueFrom || state.dueTo ? chipOn : chipOff)}>
          <CalendarDays aria-hidden /> {dueText}
        </PopoverTrigger>
        <PopoverContent className="flex flex-col gap-3 p-3 sm:flex-row" aria-label="Due date range">
          <div>
            <p className="mb-1 pl-1 text-12 font-medium text-fg-muted">From</p>
            <Calendar
              value={state.dueFrom ? parseISO(state.dueFrom) : null}
              onSelect={(d) => update({ dueFrom: dayParam(d) })}
            />
          </div>
          <div>
            <p className="mb-1 pl-1 text-12 font-medium text-fg-muted">To</p>
            <Calendar
              value={state.dueTo ? parseISO(state.dueTo) : null}
              onSelect={(d) => update({ dueTo: dayParam(d) })}
            />
            {(state.dueFrom || state.dueTo) && (
              <Button size="sm" variant="ghost" className="mt-1" onClick={() => update({ dueFrom: null, dueTo: null })}>
                <X aria-hidden /> Clear range
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {activeCount > 0 && (
        <Button size="sm" variant="ghost" onClick={clear}>
          Clear filters
        </Button>
      )}

      {showSort && (
        <div className="ml-auto flex items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(chip, "border-transparent text-fg-muted hover:bg-hover hover:text-fg")}>
              <SlidersHorizontal aria-hidden /> <span className="hidden sm:inline">Sort:</span> {sortLabel}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={state.sort} onValueChange={(v) => update({ sort: v as FilterState["sort"] })}>
                {SORTS.map((s) => (
                  <DropdownMenuRadioItem key={s.value} value={s.value}>
                    {s.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip content={state.dir === "asc" ? "Ascending" : "Descending"}>
            <button
              type="button"
              aria-label={`Sort direction: ${state.dir === "asc" ? "ascending" : "descending"}. Reverse`}
              onClick={() => update({ dir: state.dir === "asc" ? "desc" : "asc" })}
              className="inline-flex size-7 items-center justify-center rounded-sm text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-3.5"
            >
              {state.dir === "asc" ? <ArrowUpNarrowWide aria-hidden /> : <ArrowDownNarrowWide aria-hidden />}
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

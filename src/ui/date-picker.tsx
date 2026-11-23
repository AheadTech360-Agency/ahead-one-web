"use client";

import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  nextMonday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Month grid with roving focus: arrows move by day/week, PageUp/PageDown by month, Enter picks. */
export function Calendar({
  value,
  onSelect,
  initialMonth,
}: {
  value: Date | null;
  onSelect: (d: Date) => void;
  initialMonth?: Date;
}) {
  const [month, setMonth] = useState(() => startOfMonth(value ?? initialMonth ?? new Date()));
  const [focused, setFocused] = useState<Date>(() => value ?? new Date());
  const gridRef = useRef<HTMLDivElement>(null);
  const shouldFocus = useRef(false);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month]);

  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${format(focused, "yyyy-MM-dd")}"]`)
      ?.focus();
  }, [focused, month]);

  function move(next: Date) {
    shouldFocus.current = true;
    setFocused(next);
    if (!isSameMonth(next, month)) setMonth(startOfMonth(next));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const map: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => addMonths(focused, -1),
      PageDown: () => addMonths(focused, 1),
      Home: () => startOfWeek(focused, { weekStartsOn: 1 }),
      End: () => endOfWeek(focused, { weekStartsOn: 1 }),
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      move(fn());
    }
  }

  return (
    <div className="w-[252px] select-none">
      <div className="flex items-center justify-between pb-2">
        <p className="pl-1 text-13 font-semibold text-fg" aria-live="polite">
          {format(month, "MMMM yyyy")}
        </p>
        <div className="flex gap-0.5">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            className="inline-flex size-7 items-center justify-center rounded-sm text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="inline-flex size-7 items-center justify-center rounded-sm text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <div role="grid" aria-label={format(month, "MMMM yyyy")} ref={gridRef} onKeyDown={onKeyDown}>
        <div role="row" className="grid grid-cols-7">
          {WEEKDAYS.map((d) => (
            <span role="columnheader" key={d} className="flex h-7 items-center justify-center text-11 text-fg-faint">
              {d}
            </span>
          ))}
        </div>
        {Array.from({ length: days.length / 7 }, (_, w) => (
          <div role="row" key={w} className="grid grid-cols-7">
            {days.slice(w * 7, w * 7 + 7).map((d) => {
              const selected = value ? isSameDay(d, value) : false;
              const outside = !isSameMonth(d, month);
              const isFocusTarget = isSameDay(d, focused);
              return (
                <span role="gridcell" key={d.toISOString()} aria-selected={selected}>
                  <button
                    type="button"
                    data-day={format(d, "yyyy-MM-dd")}
                    tabIndex={isFocusTarget ? 0 : -1}
                    onClick={() => onSelect(d)}
                    onFocus={() => setFocused(d)}
                    aria-label={format(d, "EEEE, MMMM d, yyyy")}
                    aria-current={isToday(d) ? "date" : undefined}
                    className={cn(
                      "relative mx-auto flex size-8 items-center justify-center rounded-sm text-13 tabular",
                      "hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring",
                      outside ? "text-fg-faint" : "text-fg",
                      isToday(d) && !selected && "font-semibold text-accent-text",
                      selected && "bg-accent font-semibold text-fg-on-accent hover:bg-accent-hover",
                    )}
                  >
                    {format(d, "d")}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Due date picker: a trigger showing the date and a popover with shortcuts and a calendar. */
export function DatePicker({
  value,
  onChange,
  placeholder = "Set date",
  className,
  "aria-label": ariaLabel = "Due date",
}: {
  value: Date | null;
  onChange: (d: Date | null) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);

  function pick(d: Date | null) {
    onChange(d);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={value ? `${ariaLabel}: ${format(value, "MMMM d, yyyy")}` : ariaLabel}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-2.5 text-13",
            "hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            "data-[state=open]:border-ring",
            value ? "text-fg" : "text-fg-faint",
            className,
          )}
        >
          <CalendarDays className="size-4 text-fg-faint" aria-hidden />
          {value ? format(value, "MMM d, yyyy") : placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex p-0" aria-label="Choose date">
        <Shortcuts value={value} pick={pick} />
        <div className="p-3">
          <Calendar value={value} onSelect={(d) => pick(d)} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Rendered only while the popover is open, so "today" is read in the browser, never at prerender. */
function Shortcuts({ value, pick }: { value: Date | null; pick: (d: Date | null) => void }) {
  const [today] = useState(() => new Date());
  const shortcuts: { label: string; date: Date; hint: string }[] = [
    { label: "Today", date: today, hint: format(today, "EEE") },
    { label: "Tomorrow", date: addDays(today, 1), hint: format(addDays(today, 1), "EEE") },
    { label: "Next week", date: nextMonday(today), hint: format(nextMonday(today), "MMM d") },
  ];
  return (
        <div className="flex w-36 flex-col gap-0.5 border-r border-border-subtle p-1.5">
          {shortcuts.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => pick(s.date)}
              className="flex h-8 items-center justify-between rounded-xs px-2 text-13 text-fg hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring"
            >
              {s.label}
              <span className="text-12 text-fg-faint">{s.hint}</span>
            </button>
          ))}
          {value && (
            <button
              type="button"
              onClick={() => pick(null)}
              className="mt-auto flex h-8 items-center gap-1.5 rounded-xs px-2 text-13 text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="size-3.5" aria-hidden />
              Clear date
            </button>
          )}
        </div>
  );
}

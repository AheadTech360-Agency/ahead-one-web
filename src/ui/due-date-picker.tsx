"use client";

import { addDays, format, nextMonday } from "date-fns";
import { CalendarDays, Clock, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Calendar } from "./date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Switch } from "./checkbox";

/**
 * Date picker with an optional time of day. Date-only values have no time and show none.
 * `variant="inline"` is the borderless trigger used in dense rows and property panels.
 */
export function DueDatePicker({
  value,
  hasTime,
  onChange,
  label,
  placeholder = "Set due date",
  variant = "field",
  disabled,
  className,
  triggerClassName,
  "aria-label": ariaLabel = "Due date",
}: {
  value: Date | null;
  hasTime: boolean;
  onChange: (value: Date | null, hasTime: boolean) => void;
  /** Rendered trigger text; defaults to a formatted date. */
  label?: React.ReactNode;
  placeholder?: string;
  variant?: "field" | "inline";
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const text =
    label ?? (value ? format(value, hasTime ? "MMM d, yyyy, h:mm a" : "MMM d, yyyy") : placeholder);

  if (disabled) {
    return (
      <span
        aria-label={value ? `${ariaLabel}: ${format(value, "MMMM d, yyyy")}` : `${ariaLabel}: none`}
        className={cn(
          "inline-flex items-center gap-1.5 text-13",
          variant === "field" && "h-8 px-2.5",
          value ? "text-fg" : "text-fg-faint",
          className,
          triggerClassName,
        )}
      >
        {variant === "field" && <CalendarDays className="size-4 text-fg-faint" aria-hidden />}
        {value ? text : "None"}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={value ? `${ariaLabel}: ${format(value, hasTime ? "MMMM d, yyyy, h:mm a" : "MMMM d, yyyy")}` : ariaLabel}
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap text-13 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            variant === "field"
              ? "h-8 rounded-sm border border-border-strong bg-surface px-2.5 hover:bg-surface-sunken data-[state=open]:border-ring"
              : "h-7 rounded-xs px-1.5 hover:bg-hover data-[state=open]:bg-active",
            value ? "text-fg" : "text-fg-faint",
            className,
            triggerClassName,
          )}
        >
          {variant === "field" && <CalendarDays className="size-4 text-fg-faint" aria-hidden />}
          {text}
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex flex-col p-0 sm:flex-row" aria-label="Choose due date">
        {open && (
          <Body
            value={value}
            hasTime={hasTime}
            onChange={onChange}
            close={() => setOpen(false)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function Body({
  value,
  hasTime,
  onChange,
  close,
}: {
  value: Date | null;
  hasTime: boolean;
  onChange: (value: Date | null, hasTime: boolean) => void;
  close: () => void;
}) {
  const [today] = useState(() => new Date());
  const [timeOn, setTimeOn] = useState(hasTime);
  const [time, setTime] = useState(() => (value && hasTime ? format(value, "HH:mm") : "09:00"));

  function at(day: Date, t = time, on = timeOn) {
    if (!on) return new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const [h, m] = t.split(":").map(Number);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 0, m || 0);
  }

  function pickDay(day: Date) {
    onChange(at(day), timeOn);
    if (!timeOn) close();
  }

  const shortcuts = [
    { label: "Today", date: today, hint: format(today, "EEE") },
    { label: "Tomorrow", date: addDays(today, 1), hint: format(addDays(today, 1), "EEE") },
    { label: "Next week", date: nextMonday(today), hint: format(nextMonday(today), "MMM d") },
  ];

  return (
    <>
      <div className="flex flex-row gap-0.5 border-b border-border-subtle p-1.5 sm:w-36 sm:flex-col sm:border-b-0 sm:border-r">
        {shortcuts.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => pickDay(s.date)}
            className="flex h-8 flex-1 items-center justify-between gap-2 rounded-xs px-2 text-13 text-fg hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring sm:flex-none"
          >
            {s.label}
            <span className="hidden text-12 text-fg-faint sm:inline">{s.hint}</span>
          </button>
        ))}
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null, false);
              close();
            }}
            className="flex h-8 items-center gap-1.5 rounded-xs px-2 text-13 text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring sm:mt-auto"
          >
            <X className="size-3.5" aria-hidden />
            <span className="sr-only sm:not-sr-only">Clear date</span>
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3 p-3">
        <Calendar value={value} onSelect={pickDay} />
        <div className="flex h-8 items-center justify-between gap-3 border-t border-border-subtle pt-3">
          <Switch
            label={
              <span className="inline-flex items-center gap-1.5 font-normal">
                <Clock className="size-3.5 text-fg-faint" aria-hidden /> Time
              </span>
            }
            checked={timeOn}
            onCheckedChange={(on) => {
              setTimeOn(on);
              if (value) onChange(at(value, time, on), on);
            }}
            className="flex-row-reverse justify-end gap-2"
          />
          {timeOn && (
            <input
              type="time"
              aria-label="Time"
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                if (value && e.target.value) onChange(at(value, e.target.value, true), true);
              }}
              className="h-7 rounded-sm border border-border-strong bg-surface px-2 text-13 text-fg tabular focus-visible:border-ring focus-visible:outline-none"
            />
          )}
        </div>
      </div>
    </>
  );
}

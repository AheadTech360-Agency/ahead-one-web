"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useFieldControl } from "@/ui/field";

/**
 * Six-digit code entry drawn as six boxes. Underneath is one real input, so paste, password
 * managers, SMS/email autofill (`one-time-code`), screen readers and the keyboard all behave as
 * they do for any text field. The boxes only show what the input holds.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  autoFocus = true,
  label = "6-digit sign-in code",
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const field = useFieldControl({ "aria-invalid": invalid ? true : undefined });
  const active = Math.min(value.length, 5);

  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <div aria-hidden className="grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }, (_, i) => {
          const on = focused && i === active;
          return (
            <span
              key={i}
              className={cn(
                "flex h-16 items-center justify-center rounded-sm border bg-surface font-display text-[32px] font-semibold tabular text-fg",
                "transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-out",
                invalid ? "border-danger" : value[i] ? "border-accent" : "border-border-strong",
                on && "border-ring shadow-[0_3px_0_0_var(--green)]",
                disabled && "bg-surface-sunken text-fg-muted",
              )}
            >
              {value[i] ?? (on ? <span className="h-6 w-px animate-pulse bg-fg motion-reduce:animate-none" /> : null)}
            </span>
          );
        })}
      </div>
      <input
        ref={ref}
        {...field}
        aria-label={label}
        autoFocus={autoFocus}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={12}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          // Accept "123 456" and "123-456" pastes.
          const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
          onChange(digits);
          if (digits.length === 6 && digits !== value) onComplete?.(digits);
        }}
        className="absolute inset-0 size-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 outline-none"
      />
    </div>
  );
}

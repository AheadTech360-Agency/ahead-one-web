"use client";

import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFieldControl } from "./field";

export type SelectOption = { value: string; label: string; description?: string; disabled?: boolean };

/** Single-value select built on Radix (keyboard type-ahead, focus restore). */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Select",
  size = "md",
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
  name,
}: {
  value?: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  name?: string;
}) {
  const field = useFieldControl({ id });
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled} name={name}>
      <SelectPrimitive.Trigger
        {...field}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex w-full items-center justify-between gap-2 rounded-sm border border-border-strong bg-surface px-2.5 text-left text-fg",
          "transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-out hover:bg-surface-sunken",
          "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--ring)_22%,transparent)]",
          "data-[placeholder]:text-fg-faint disabled:cursor-not-allowed disabled:opacity-60",
          "aria-[invalid=true]:border-danger",
          size === "sm" ? "h-7 text-12" : "h-8 text-13",
          className,
        )}
      >
        <span className="truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-3.5 shrink-0 text-fg-faint" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "z-[var(--z-popover)] max-h-[min(var(--radix-select-content-available-height),320px)] min-w-[var(--radix-select-trigger-width)] overflow-hidden",
            "rounded-md border border-border bg-surface-raised shadow-popover data-[state=open]:animate-in-pop",
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className={cn(
                  "relative flex cursor-default select-none flex-col rounded-xs py-1.5 pl-7 pr-2 text-13 text-fg outline-none",
                  "data-[highlighted]:bg-hover data-[disabled]:opacity-50",
                )}
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2 top-2 flex">
                  <Check className="size-3.5 text-accent" aria-hidden />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                {o.description && <span className="text-12 text-fg-muted">{o.description}</span>}
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

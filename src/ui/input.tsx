"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useFieldControl } from "./field";

export const controlBase =
  "w-full rounded-sm border border-border-strong bg-surface text-fg placeholder:text-fg-faint " +
  "transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-out " +
  "hover:border-[color-mix(in_srgb,var(--border-strong)_70%,var(--fg)_30%)] " +
  "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--ring)_22%,transparent)] " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-[color-mix(in_srgb,var(--danger)_22%,transparent)] " +
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-muted";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: "sm" | "md" | "lg";
  /** Decorative leading icon (14-16px). */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
};

const heights = { sm: "h-7 text-12", md: "h-8 text-13", lg: "h-9 text-14" } as const;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, size = "md", leading, trailing, ...props },
  ref,
) {
  const field = useFieldControl(props);
  const input = (
    <input
      ref={ref}
      {...props}
      {...field}
      className={cn(
        controlBase,
        heights[size],
        "px-2.5",
        leading && "pl-8",
        trailing && "pr-8",
        !leading && !trailing && className,
      )}
    />
  );
  if (!leading && !trailing) return input;
  return (
    <div className={cn("relative flex items-center", className)}>
      {leading && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-2.5 flex text-fg-faint [&_svg]:size-4"
        >
          {leading}
        </span>
      )}
      {input}
      {trailing && <span className="absolute right-2 flex items-center">{trailing}</span>}
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 3, ...props }, ref) {
  const field = useFieldControl(props);
  return (
    <textarea
      ref={ref}
      rows={rows}
      {...props}
      {...field}
      className={cn(controlBase, "min-h-16 resize-y px-2.5 py-1.5 text-13 leading-5", className)}
    />
  );
});

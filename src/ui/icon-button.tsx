"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "./tooltip";

type Size = "sm" | "md" | "lg";

const sizes: Record<Size, string> = {
  sm: "size-7 [&_svg]:size-3.5",
  md: "size-8 [&_svg]:size-4",
  lg: "size-9 [&_svg]:size-[18px]",
};

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  /** Required: becomes both the accessible name and the tooltip. */
  label: string;
  shortcut?: string[];
  size?: Size;
  variant?: "ghost" | "secondary";
  tooltipSide?: "top" | "right" | "bottom" | "left";
  /** Hide the tooltip (e.g. while a menu it opens is showing). The label stays. */
  noTooltip?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, shortcut, size = "md", variant = "ghost", tooltipSide, noTooltip, className, type, ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type ?? "button"}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm text-fg-muted",
        "transition-colors duration-[var(--dur-fast)] ease-out",
        "hover:bg-hover hover:text-fg active:bg-active data-[state=open]:bg-active data-[state=open]:text-fg",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "secondary" && "border border-border-strong bg-surface",
        sizes[size],
        className,
      )}
      {...props}
    />
  );
  if (noTooltip) return button;
  return (
    <Tooltip content={label} shortcut={shortcut} side={tooltipSide}>
      {button}
    </Tooltip>
  );
});

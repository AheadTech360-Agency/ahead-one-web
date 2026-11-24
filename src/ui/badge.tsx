"use client";

import { Flag } from "lucide-react";
import { useBump } from "@/lib/hooks/use-bump";
import { cn } from "@/lib/utils";
import type { Priority, StatusCategory } from "@/lib/api/types";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-active text-fg-muted",
  accent: "bg-accent-subtle text-accent-text",
  success: "bg-success-subtle text-success-text",
  warning: "bg-warning-subtle text-warning-text",
  danger: "bg-danger-subtle text-danger-text",
  info: "bg-info-subtle text-info-text",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 flex-none items-center gap-1 whitespace-nowrap rounded-xs px-1.5 text-11 font-medium [&_svg]:size-3",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Count bubble for nav rows and the bell. */
export function CountBadge({ count, className, animated }: { count: number; className?: string; animated?: boolean }) {
  const bump = useBump(count);
  if (count <= 0) return null;
  return (
    <span
      key={animated ? bump : undefined}
      className={cn(
        animated && bump > 0 && "animate-badge",
        "inline-flex h-4 min-w-4 flex-none items-center justify-center rounded-full bg-green px-1 text-11 font-bold leading-none text-navy-deep tabular",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

const priorityMeta: Record<Priority, { label: string; color: string; filled: boolean }> = {
  urgent: { label: "Urgent", color: "text-priority-urgent", filled: true },
  high: { label: "High", color: "text-priority-high", filled: true },
  normal: { label: "Normal", color: "text-priority-normal", filled: false },
  low: { label: "Low", color: "text-priority-low", filled: false },
};

export const PRIORITIES: Priority[] = ["urgent", "high", "normal", "low"];

export function priorityLabel(p: Priority) {
  return priorityMeta[p].label;
}

/** Flag icon plus label, coloured by priority. Use `iconOnly` in dense rows (keeps an accessible name). */
export function PriorityBadge({
  priority,
  iconOnly = false,
  className,
}: {
  priority: Priority;
  iconOnly?: boolean;
  className?: string;
}) {
  const m = priorityMeta[priority];
  return (
    <span
      className={cn("inline-flex flex-none items-center gap-1 whitespace-nowrap text-12 text-fg-muted", className)}
      title={iconOnly ? `${m.label} priority` : undefined}
    >
      <Flag
        className={cn("size-3.5", m.color)}
        fill={m.filled ? "currentColor" : "none"}
        strokeWidth={2}
        aria-hidden
      />
      {iconOnly ? <span className="sr-only">{m.label} priority</span> : m.label}
    </span>
  );
}

/**
 * Status pill coloured from the list status's own hex colour (ListStatus.color).
 * The tint and text are mixed from that colour so any user-picked hue stays legible in both themes.
 */
export function StatusPill({
  name,
  color,
  category,
  className,
}: {
  name: string;
  color: string;
  category?: StatusCategory;
  className?: string;
}) {
  const done = category === "done" || category === "closed";
  return (
    <span
      className={cn(
        "inline-flex h-5 flex-none items-center gap-1.5 whitespace-nowrap rounded-full pl-1.5 pr-2 text-11 font-medium",
        className,
      )}
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 14%, var(--surface))`,
        color: `color-mix(in oklab, ${color} 62%, var(--fg))`,
      }}
    >
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={
          done
            ? { backgroundColor: color }
            : category === "active"
              ? { background: `conic-gradient(${color} 0 50%, transparent 50% 100%)`, boxShadow: `inset 0 0 0 1.5px ${color}` }
              : { boxShadow: `inset 0 0 0 1.5px ${color}` }
        }
      />
      {name}
    </span>
  );
}

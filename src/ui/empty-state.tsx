import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Empty or error state: one outline icon, a title, one line, an optional action.
 * Keeps the frame of the block it sits in. No illustrations.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "neutral" | "danger";
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-16",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface",
          tone === "danger" ? "text-danger-text" : "text-fg-faint",
        )}
      >
        <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-14 font-semibold text-fg">{title}</p>
        {description && <p className="text-13 text-fg-muted">{description}</p>}
      </div>
      {action && <div className="mt-1 flex items-center gap-2">{action}</div>}
    </div>
  );
}

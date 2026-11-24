"use client";

import { ChevronRight, Plus } from "lucide-react";
import { useId } from "react";
import { useStoredState } from "@/lib/hooks/use-stored-state";
import { cn } from "@/lib/utils";
import { IconButton } from "@/ui/icon-button";

/** A collapsible group in the sidebar with a sentence-case heading and an optional add action. */
export function SidebarSection({
  title,
  storageKey,
  action,
  actions,
  children,
  className,
}: {
  title: string;
  storageKey: string;
  action?: { label: string; onClick: () => void };
  /** Custom header controls (for example a menu trigger), shown on hover like `action`. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [collapsed, setCollapsed] = useStoredState(`ahead-one.section.${storageKey}`, false);
  const id = useId();
  return (
    <section className={cn("flex flex-col", className)} aria-labelledby={`${id}-h`}>
      <div className="group/sec flex h-7 items-center pr-1">
        <h2 id={`${id}-h`} className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={`${id}-c`}
            onClick={() => setCollapsed((c) => !c)}
            className="flex h-6 items-center gap-1 rounded-xs px-2 text-12 font-medium text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
          >
            {title}
            <ChevronRight
              aria-hidden
              className={cn(
                "size-3 text-fg-faint opacity-0 transition-[transform,opacity] duration-[var(--dur-fast)] group-hover/sec:opacity-100",
                !collapsed && "rotate-90",
                collapsed && "opacity-100",
              )}
            />
          </button>
        </h2>
        {action && (
          <IconButton
            label={action.label}
            size="sm"
            tooltipSide="right"
            onClick={action.onClick}
            className="size-6 opacity-0 group-hover/sec:opacity-100 focus-visible:opacity-100"
          >
            <Plus aria-hidden />
          </IconButton>
        )}
        {actions && (
          <div className="flex items-center opacity-0 group-hover/sec:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100">
            {actions}
          </div>
        )}
      </div>
      <div id={`${id}-c`} hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}

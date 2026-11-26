import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Delta } from "../lib/logic";

/** A ledger panel: hairline border on the sheet, a quiet header row, content below. */
export function Panel({
  title,
  count,
  aside,
  className,
  bodyClassName,
  children,
  id,
}: {
  title: string;
  count?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col rounded-md border border-border bg-surface", className)}>
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border-subtle px-4">
        <h2 id={id} className="text-13 font-semibold text-fg">
          {title}
        </h2>
        {count !== undefined && (
          <span className="rounded-full bg-active px-1.5 text-11 font-medium leading-4 text-fg-muted tabular">{count}</span>
        )}
        {aside && <div className="ml-auto flex items-center gap-3 text-12 text-fg-muted">{aside}</div>}
      </header>
      <div className={cn("min-w-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Legend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <span className="flex items-center gap-3" aria-hidden>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-[2px]", i.className)} /> {i.label}
        </span>
      ))}
    </span>
  );
}

export function DeltaChip({ delta, className }: { delta: Delta; className?: string }) {
  const Icon = delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : ArrowRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-12 font-medium tabular",
        delta.direction === "up" ? "text-success-text" : delta.direction === "down" ? "text-warning-text" : "text-fg-muted",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden strokeWidth={2} />
      {delta.text}
    </span>
  );
}

/** The client's colour as a small square marker, the way the sidebar marks a space. */
export function ClientDot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-[2px]", className)} style={{ backgroundColor: color }} />;
}

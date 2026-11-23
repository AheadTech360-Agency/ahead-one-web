import { cn } from "@/lib/utils";

/** A key cap. Pass several children for a chord: <Kbd>Ctrl</Kbd><Kbd>K</Kbd>. */
export function Kbd({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-xs border border-border bg-surface-sunken px-1",
        "font-sans text-11 font-medium leading-none text-fg-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function KbdCombo({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </span>
  );
}

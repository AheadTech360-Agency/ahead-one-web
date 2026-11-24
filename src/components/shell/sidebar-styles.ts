/** Shared sidebar row look. `.sb-row` (globals.css) supplies the hover, press and active layers. */
export const sbRow =
  "sb-row flex h-[30px] items-center rounded-sm text-13 outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring";

export const sbRowIdle = "text-fg-muted hover:text-fg";
export const sbRowActive = "text-accent-text";

/** Labels fade out as the rail closes and in just after the column opens. Never wraps, never moves. */
export const sbLabel =
  "whitespace-nowrap transition-opacity duration-[var(--dur-fast)] group-data-[rail=true]/sb:opacity-0 group-data-[rail=false]/sb:delay-[60ms]";

import { cn } from "@/lib/utils";

/**
 * The AheadTech360 mark, inline so its fills follow the theme: brand navy and green on light,
 * a lifted navy on the dark grounds so the stroke keeps its contrast. Same paths as
 * public/brand/mark.svg. Decorative by default; pass `label` when it stands alone.
 */
export function BrandMark({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="24 16 172 168"
      className={cn("size-6 shrink-0", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path fill="var(--mark-navy)" d="M40 176 L70 176 L111 24 L81 24 Z" />
      <path
        fill="var(--mark-green)"
        fillRule="evenodd"
        d="M113 24 H143 L188 176 H157 L146 140 L118 176 H86 L130 118 L101 66 Z M128 70 L140 112 L134 120 L117 92 Z"
      />
    </svg>
  );
}

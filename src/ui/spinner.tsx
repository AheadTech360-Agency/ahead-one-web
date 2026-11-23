import { cn } from "@/lib/utils";

/** Indeterminate inline loader. Use for waits of roughly 100ms to 1s; prefer Skeleton beyond. */
export function Spinner({
  className,
  size = 14,
  label = "Loading",
}: {
  className?: string;
  size?: number;
  label?: string;
}) {
  return (
    <svg
      role="status"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={cn("shrink-0 animate-spin motion-reduce:animate-[spin_1.6s_linear_infinite]", className)}
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.5" />
      <path
        d="M14.25 8A6.25 6.25 0 0 0 8 1.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

import { cn } from "@/lib/utils";

/** Flat placeholder at the real size of what it stands in for. No shimmer. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("rounded-xs bg-active motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}

/** Table-shaped skeleton: keeps the header and the row pitch so nothing shifts when data lands. */
export function SkeletonRows({
  rows = 6,
  columns = [40, 20, 15, 15],
  className,
}: {
  rows?: number;
  columns?: number[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex h-11 items-center gap-6 border-b border-border-subtle px-3">
          {columns.map((w, c) => (
            <Skeleton
              key={c}
              className="h-3"
              style={{ width: `${Math.max(8, w - ((r * 7 + c * 5) % 12))}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

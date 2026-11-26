import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import type { DashboardKind } from "../lib/logic";

const panel = "rounded-md border border-border bg-surface";

function PanelSkeleton({ className, rows = 4 }: { className?: string; rows?: number }) {
  return (
    <div className={cn(panel, className)}>
      <div className="flex h-11 items-center border-b border-border-subtle px-4">
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="flex flex-col">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex h-[52px] items-center gap-3 border-b border-border-subtle px-4 last:border-b-0">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="ml-auto h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Same grid as the loaded dashboard, so the page does not move when data lands. */
export function TeamSkeleton({ kind }: { kind: DashboardKind }) {
  const exec = kind === "executive";
  return (
    <div role="status" aria-label="Loading dashboard" className="flex flex-col gap-4">
      {exec ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className={cn(panel, "h-[300px] p-5 lg:col-span-8")}>
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-4 h-10 w-24" />
            <Skeleton className="mt-6 h-[140px] w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:col-span-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex min-h-[112px] flex-col justify-between rounded-md bg-surface-sunken p-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-12" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={cn(panel, "grid grid-cols-2 lg:grid-cols-4")}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex min-h-[104px] flex-col justify-between p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-14" />
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-12">
        <PanelSkeleton className="lg:col-span-7" rows={5} />
        <PanelSkeleton className="lg:col-span-5" rows={5} />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <PanelSkeleton className="lg:col-span-7" rows={3} />
        <PanelSkeleton className="lg:col-span-5" rows={3} />
      </div>
    </div>
  );
}

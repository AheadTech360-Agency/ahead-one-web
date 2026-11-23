import { PageBody } from "@/components/page";
import { Skeleton, SkeletonRows } from "@/ui/skeleton";

/** Title row placeholder at the real size of PageHeader. */
export function HeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex items-start justify-between" aria-hidden>
      <div className="flex flex-col gap-2 pt-1">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-64" />
      </div>
      {withAction && <Skeleton className="h-8 w-28 rounded-sm" />}
    </div>
  );
}

export function ListPageSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <PageBody role="status" aria-label={label}>
      <HeaderSkeleton withAction />
      <div className="mt-6 flex gap-5 border-b border-border pb-2" aria-hidden>
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
      <SkeletonRows rows={8} columns={[44, 14, 12, 10]} className="mt-2" />
    </PageBody>
  );
}

/** Board-style placeholder for project and list views (built in a later task). */
export function BoardSkeleton({ label }: { label: string }) {
  return (
    <PageBody role="status" aria-label={label}>
      <HeaderSkeleton withAction />
      <div className="mt-6 flex gap-2" aria-hidden>
        {[16, 14, 12].map((w, i) => (
          <Skeleton key={i} className="h-7 rounded-sm" style={{ width: `${w * 6}px` }} />
        ))}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3" aria-hidden>
        {[5, 3, 4].map((n, c) => (
          <div key={c} className="flex flex-col gap-2 rounded-md bg-surface-sunken p-2">
            <Skeleton className="m-1 h-3 w-20" />
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-sm border border-border bg-surface p-3">
                <Skeleton className="h-3" style={{ width: `${60 + ((i * 17 + c * 9) % 35)}%` }} />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="size-5 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </PageBody>
  );
}

export function DetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="grid min-h-full md:grid-cols-[1fr_320px]">
      <PageBody width="narrow">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="mt-4 h-6 w-3/4" />
        <div className="mt-6 flex flex-col gap-2.5">
          {[92, 88, 95, 60].map((w, i) => (
            <Skeleton key={i} className="h-3" style={{ width: `${w}%` }} />
          ))}
        </div>
        <Skeleton className="mt-10 h-4 w-24" />
        <SkeletonRows rows={4} columns={[60, 12]} className="mt-2" />
      </PageBody>
      <div className="hidden flex-col gap-4 border-l border-border-subtle p-5 md:flex" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConversationSkeleton() {
  return (
    <div role="status" aria-label="Loading conversation" className="flex h-full flex-col">
      <div className="flex h-12 items-center gap-2 border-b border-border-subtle px-5" aria-hidden>
        <Skeleton className="size-4 rounded-xs" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="flex flex-1 flex-col justify-end gap-5 p-5" aria-hidden>
        {[70, 45, 85, 55].map((w, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3" style={{ width: `${w}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="m-4 h-20 rounded-md border border-border" aria-hidden />
    </div>
  );
}

import { PageBody } from "@/components/page";
import { HeaderSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/ui/skeleton";

export default function Loading() {
  return (
    <PageBody role="status" aria-label="Loading">
      <HeaderSkeleton withAction />
      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]" aria-hidden>
        {[0, 1].map((col) => (
          <div key={col} className="flex flex-col gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-md border border-border">
                <div className="flex h-11 items-center border-b border-border-subtle px-4">
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex flex-col gap-3 p-4">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </PageBody>
  );
}

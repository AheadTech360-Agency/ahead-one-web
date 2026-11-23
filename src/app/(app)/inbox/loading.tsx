import { PageBody } from "@/components/page";
import { HeaderSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/ui/skeleton";

export default function Loading() {
  return (
    <PageBody width="narrow" role="status" aria-label="Loading inbox">
      <HeaderSkeleton withAction />
      <div className="mt-7 flex flex-col" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex gap-3 px-3 py-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <Skeleton className="h-3" style={{ width: `${50 + ((i * 13) % 40)}%` }} />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
        ))}
      </div>
    </PageBody>
  );
}

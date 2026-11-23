import { HeaderSkeleton } from "@/components/skeletons";
import { SkeletonRows } from "@/ui/skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Loading settings">
      <HeaderSkeleton />
      <SkeletonRows rows={6} columns={[36, 20, 12]} className="mt-6" />
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { ListPageSkeleton } from "@/components/skeletons";
import { ListScreen } from "@/features/tasks/screens/list-screen";

export const metadata: Metadata = { title: "List" };

export default function ListPage() {
  return (
    <Suspense fallback={<ListPageSkeleton label="Loading list" />}>
      <ListScreen />
    </Suspense>
  );
}

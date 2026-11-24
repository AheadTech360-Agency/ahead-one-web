import type { Metadata } from "next";
import { Suspense } from "react";
import { ListPageSkeleton } from "@/components/skeletons";
import { MyTasksScreen } from "@/features/tasks/screens/my-tasks-screen";

export const metadata: Metadata = { title: "My tasks" };

export default function MyTasksPage() {
  return (
    <Suspense fallback={<ListPageSkeleton label="Loading my tasks" />}>
      <MyTasksScreen />
    </Suspense>
  );
}

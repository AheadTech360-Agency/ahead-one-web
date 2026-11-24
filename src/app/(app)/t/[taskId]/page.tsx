import type { Metadata } from "next";
import { Suspense } from "react";
import { DetailSkeleton } from "@/components/skeletons";
import { TaskScreen } from "@/features/tasks/screens/task-screen";

export const metadata: Metadata = { title: "Task" };

export default function TaskPage() {
  return (
    <Suspense fallback={<DetailSkeleton label="Loading task" />}>
      <TaskScreen />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardSkeleton } from "@/components/skeletons";
import { ProjectScreen } from "@/features/tasks/screens/project-screen";

export const metadata: Metadata = { title: "Project" };

export default function ProjectPage() {
  return (
    <Suspense fallback={<BoardSkeleton label="Loading project" />}>
      <ProjectScreen />
    </Suspense>
  );
}

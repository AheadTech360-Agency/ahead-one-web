import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectSettingsScreen, SettingsSkeleton } from "@/features/tasks/screens/project-settings-screen";

export const metadata: Metadata = { title: "Project settings" };

export default function ProjectSettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <ProjectSettingsScreen />
    </Suspense>
  );
}

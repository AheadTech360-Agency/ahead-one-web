import type { Metadata } from "next";
import { Suspense } from "react";
import { ListPageSkeleton } from "@/components/skeletons";
import { FilesScreen } from "@/features/files/files-screen";

export const metadata: Metadata = { title: "Files" };

export default function FilesPage() {
  return (
    <Suspense fallback={<ListPageSkeleton label="Loading files" />}>
      <FilesScreen />
    </Suspense>
  );
}

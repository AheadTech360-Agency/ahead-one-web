import { BoardSkeleton } from "@/components/skeletons";

/** Project view (list, board, calendar) arrives with the task-views task. */
export default function ProjectPage() {
  return <BoardSkeleton label="Loading project" />;
}

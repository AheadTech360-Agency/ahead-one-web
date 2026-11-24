"use client";

import { useParams, useRouter } from "next/navigation";
import { TaskDetail } from "../components/task-detail";

const pageHref = (id: string) => `/t/${id}`;

export function TaskScreen() {
  const { taskId } = useParams<{ taskId: string }>();
  const router = useRouter();
  return <TaskDetail key={taskId} taskId={taskId} layout="page" hrefFor={pageHref} onDeleted={() => router.push("/my-tasks")} />;
}

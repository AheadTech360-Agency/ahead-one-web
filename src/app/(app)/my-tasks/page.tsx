"use client";

import { CalendarClock, CalendarDays, CircleAlert, ListChecks, Plus } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";

const BUCKETS = [
  { value: "today", label: "Today", icon: CalendarDays, title: "Nothing due today", line: "Tasks assigned to you and due today." },
  { value: "upcoming", label: "Upcoming", icon: CalendarClock, title: "No upcoming tasks", line: "Your tasks due in the coming days." },
  { value: "overdue", label: "Overdue", icon: CircleAlert, title: "Nothing overdue", line: "Open tasks that are past their due date." },
  { value: "all", label: "All", icon: ListChecks, title: "No tasks assigned to you", line: "Every open task assigned to you, across projects." },
] as const;

/** Placeholder: rows come from GET /v1/workspaces/:ws/my-tasks?bucket= in the task-views task. */
export default function MyTasksPage() {
  const { setCreateTaskOpen } = useShell();
  return (
    <PageBody>
      <PageHeader
        title="My tasks"
        description="Everything assigned to you, grouped by when it's due."
        actions={
          <Button variant="primary" onClick={() => setCreateTaskOpen(true)}>
            <Plus aria-hidden /> New task
          </Button>
        }
      />
      <Tabs defaultValue="today" className="mt-5">
        <TabsList>
          {BUCKETS.map((b) => (
            <TabsTrigger key={b.value} value={b.value}>
              {b.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {BUCKETS.map((b) => (
          <TabsContent key={b.value} value={b.value} className="outline-none">
            <EmptyState icon={b.icon} title={b.title} description={b.line} />
          </TabsContent>
        ))}
      </Tabs>
    </PageBody>
  );
}

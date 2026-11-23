"use client";

import { format } from "date-fns";
import { AtSign, CalendarClock, CalendarDays, CircleAlert, Plus } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { PageBody, PageHeader, Panel } from "@/components/page";
import { useShell } from "@/components/shell/shell-context";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";

const noop = () => () => {};

/**
 * Home dashboard placeholder. The frames are final; each block fills from
 * GET /v1/workspaces/:ws/dashboard when the dashboard task ships.
 */
export function HomeView() {
  const { me, meStatus, current } = useWorkspace();
  const { setCreateTaskOpen } = useShell();
  const today = useSyncExternalStore(noop, () => format(new Date(), "EEEE, MMMM d"), () => "");
  const firstName = me?.user.full_name?.split(" ")[0];

  return (
    <PageBody>
      <PageHeader
        title={
          meStatus === "success" && firstName ? `Good to see you, ${firstName}` : "Home"
        }
        description={
          today ? `${today}${current ? `, ${current.workspace.name}` : ""}` : " "
        }
        actions={
          <Button variant="primary" onClick={() => setCreateTaskOpen(true)}>
            <Plus aria-hidden /> New task
          </Button>
        }
      />

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <Panel title="Due today" meta={<Link className="hover:text-fg hover:underline" href="/my-tasks">View my tasks</Link>}>
            <EmptyState
              compact
              icon={CalendarDays}
              title="No tasks due today"
              description="Tasks assigned to you with today's due date are listed here."
            />
          </Panel>
          <Panel title="Overdue">
            <EmptyState
              compact
              icon={CircleAlert}
              title="Nothing overdue"
              description="Anything past its due date and still open is pulled up here."
            />
          </Panel>
        </div>
        <div className="flex flex-col gap-4">
          <Panel title="Coming up">
            <EmptyState
              compact
              icon={CalendarClock}
              title="Next 7 days are clear"
              description="Upcoming due dates for your tasks."
            />
          </Panel>
          <Panel title="Mentions">
            <EmptyState
              compact
              icon={AtSign}
              title="No recent mentions"
              description="Tasks and channels where someone @mentions you."
            />
          </Panel>
        </div>
      </div>
    </PageBody>
  );
}

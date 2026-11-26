/*
 * The team dashboard's response, as the screens use it. TeamDashboard and its parts come from the
 * generated API types. The scope, clients and timeline fields (and the client-access DTO) are the
 * contract extension that was still landing in the API's bindings when this was written: they are
 * declared here, in one place, and must be deleted in favour of the generated types the moment
 * `npm run sync-types` brings them (see TODO in `TeamDashboardData`).
 */
import type { TeamDashboard, UserSummary } from "@/lib/api/types";

export type TimelineTask = {
  task_id: string;
  title: string;
  due_at: string;
  priority: "urgent" | "high" | "normal" | "low";
  project_id: string;
  project_name: string;
  space_id: string;
  space_name: string;
  space_color: string;
  assignees: UserSummary[];
};

export type TimelineBucket = { total: number; items: TimelineTask[] };

export type Timeline = {
  overdue: TimelineBucket;
  today: TimelineBucket;
  tomorrow: TimelineBucket;
  this_week: TimelineBucket;
};

export type ClientSummary = {
  space_id: string;
  name: string;
  color: string;
  projects: number;
  open: number;
  overdue: number;
  done_7d: number;
  members: number;
};

export type TeamScope = { space_id: string; space_name: string } | null;

export type TeamDashboardData = TeamDashboard & {
  scope: TeamScope;
  clients: ClientSummary[];
  unassigned_open: number;
  timeline: Timeline;
};

export type ClientAccessBody = { all_clients: boolean; space_ids: string[] };

"use client";

import dynamic from "next/dynamic";
import { HomeDashboard } from "@/features/tasks/screens/home-dashboard";
import { canSeeTeamDashboard } from "@/features/team/lib/logic";
import { useWorkspace } from "@/lib/workspace";
import Loading from "./loading";

/* Owner, Admin and Management code is only fetched for those roles; Member and Guest never load it. */
const TeamHome = dynamic(() => import("@/features/team/team-home").then((m) => m.TeamHome), { loading: () => <Loading /> });

/**
 * Home by role. Member and Guest keep the personal Home (GET /v1/workspaces/:ws/dashboard).
 * Owner (executive overview), Admin and Management (operations board) get the team dashboard.
 * The role comes from the signed-in membership; the API still enforces access on every request.
 */
export function HomeView() {
  const { role, meStatus } = useWorkspace();
  if (!role) return meStatus === "pending" ? <Loading /> : <HomeDashboard />;
  return canSeeTeamDashboard(role) ? <TeamHome /> : <HomeDashboard />;
}

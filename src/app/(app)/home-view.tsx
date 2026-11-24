"use client";

import { HomeDashboard } from "@/features/tasks/screens/home-dashboard";

/** Home: the role dashboard from GET /v1/workspaces/:ws/dashboard (org, management or personal). */
export function HomeView() {
  return <HomeDashboard />;
}

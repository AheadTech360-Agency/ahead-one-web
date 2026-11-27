import type { Metadata } from "next";
import { ConnectedAppsView } from "@/features/connected-apps/connected-apps-view";

export const metadata: Metadata = { title: "Connected apps" };

export default function ConnectedAppsPage() {
  return <ConnectedAppsView />;
}

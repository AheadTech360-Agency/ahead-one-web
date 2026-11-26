import type { Metadata } from "next";
import { AndroidAppView } from "./android-app-view";

export const metadata: Metadata = { title: "Get the Android app" };

export default function AndroidAppPage() {
  return <AndroidAppView />;
}

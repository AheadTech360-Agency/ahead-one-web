import { redirect } from "next/navigation";

/** The app-update notification links here; the download lives under the Android app page. */
export default function UpdateRedirect() {
  redirect("/settings/android-app");
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeView } from "./home-view";
import Loading from "./loading";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <HomeView />
    </Suspense>
  );
}

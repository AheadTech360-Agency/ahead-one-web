"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageBody, PageHeader } from "@/components/page";
import { ConsentCard, ConsentProblem, ConsentSkeleton } from "@/features/connected-apps/consent-card";
import { FIXTURE_GRANTS, FIXTURE_MULTI, FIXTURE_REQUEST, FIXTURE_UNVERIFIED } from "@/features/connected-apps/fixtures";
import { GrantsPanel } from "@/features/connected-apps/grants-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";

/** ?view=consent|unverified|submitting|error|expired|invalid|unsafe|loading|grants|empty|everyone|loadingGrants */
export function Preview() {
  const view = useSearchParams().get("view") ?? "consent";
  const [grants, setGrants] = useState(FIXTURE_GRANTS);
  const frame = (n: React.ReactNode) => <div className="flex min-h-dvh items-start justify-center bg-bg px-4 py-8 sm:items-center">{n}</div>;
  const noop = () => {};
  switch (view) {
    case "unverified":
      return frame(<ConsentCard info={FIXTURE_UNVERIFIED} userName="Ayesha Khan" userEmail="ayesha@example.test" phase="idle" onDecide={noop} />);
    case "multi":
      return frame(<ConsentCard info={FIXTURE_MULTI} userName="Ayesha Khan" userEmail="ayesha@example.test" phase="idle" onDecide={noop} />);
    case "submitting":
      return frame(<ConsentCard info={FIXTURE_REQUEST} userName="Ayesha Khan" phase="submitting" onDecide={noop} />);
    case "error":
      return frame(<ConsentCard info={FIXTURE_REQUEST} userName="Ayesha Khan" phase="error" error="Can't reach the server. Check your connection and try again." onDecide={noop} />);
    case "expired":
    case "invalid":
    case "unsafe":
    case "network":
      return frame(<ConsentProblem kind={view} onRetry={noop} />);
    case "loading":
      return frame(<ConsentSkeleton />);
    case "grants":
    case "empty":
    case "everyone":
    case "loadingGrants":
      return (
        <PageBody>
          <PageHeader title="Connected apps" description="AI apps you allowed to work in AheadOne on your behalf." />
          <div className="mt-5">
            {view === "everyone" ? (
              <Tabs defaultValue="everyone">
                <TabsList>
                  <TabsTrigger value="mine">My apps</TabsTrigger>
                  <TabsTrigger value="everyone">Everyone&apos;s apps</TabsTrigger>
                </TabsList>
                <TabsContent value="everyone" className="pt-4">
                  <GrantsPanel grants={grants} loading={false} showUser canRevoke={() => true} onRevoke={(g) => setGrants((x) => x.filter((y) => y.id !== g.id))} emptyIsSetup={false} />
                </TabsContent>
              </Tabs>
            ) : (
              <GrantsPanel
                grants={view === "empty" ? [] : grants}
                loading={view === "loadingGrants"}
                showUser={false}
                canRevoke={() => true}
                onRevoke={(g) => setGrants((x) => x.filter((y) => y.id !== g.id))}
              />
            )}
          </div>
        </PageBody>
      );
    default:
      return frame(<ConsentCard info={FIXTURE_REQUEST} userName="Ayesha Khan" userEmail="ayesha@example.test" phase="idle" onDecide={noop} />);
  }
}

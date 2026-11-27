"use client";

import { PageHeader } from "@/components/page";
import { errorMessage } from "@/lib/api/client";
import { useWorkspace } from "@/lib/workspace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { toast } from "@/ui/toaster";
import { useOAuthGrants, useRevokeGrant } from "./api";
import type { OauthGrant } from "@/lib/api/types";
import { GrantsPanel, SetupGuide } from "./grants-panel";
import { canSeeEveryonesApps } from "./logic";

/** Settings, Connected apps: my grants, plus an Owner-only tab with everyone's. */
export function ConnectedAppsView() {
  const { role, workspaceId } = useWorkspace();
  const owner = canSeeEveryonesApps(role);
  const mine = useOAuthGrants(undefined);
  const everyone = useOAuthGrants(workspaceId, owner && Boolean(workspaceId));
  const revoke = useRevokeGrant();

  function onRevoke(g: OauthGrant, viaWorkspace = false) {
    revoke.mutate({ grant: g, viaWorkspace }, {
      onSuccess: () => toast.success(`Revoked ${g.client_name}`, { description: "It can no longer reach the account." }),
      onError: (e) => toast.error(`Couldn't revoke ${g.client_name}`, { description: `${errorMessage(e)} It is back in the list.` }),
    });
  }

  const myPanel = (
    <>
      <GrantsPanel
        grants={mine.data}
        loading={mine.isPending}
        error={mine.isError ? errorMessage(mine.error) : undefined}
        onRetry={() => void mine.refetch()}
        showUser={false}
        canRevoke={() => true}
        onRevoke={onRevoke}
      />
      {mine.data && mine.data.length > 0 && <SetupGuide />}
    </>
  );

  return (
    <>
      <PageHeader title="Connected apps" description="AI apps you allowed to work in AheadOne on your behalf." />
      <div className="mt-5">
        {owner ? (
          <Tabs defaultValue="mine">
            <TabsList>
              <TabsTrigger value="mine">My apps</TabsTrigger>
              <TabsTrigger value="everyone">Everyone&apos;s apps</TabsTrigger>
            </TabsList>
            <TabsContent value="mine" className="pt-4 outline-none">
              {myPanel}
            </TabsContent>
            <TabsContent value="everyone" className="pt-4 outline-none">
              <GrantsPanel
                grants={everyone.data}
                loading={everyone.isPending}
                error={everyone.isError ? errorMessage(everyone.error) : undefined}
                onRetry={() => void everyone.refetch()}
                showUser
                canRevoke={() => true}
                onRevoke={(g) => onRevoke(g, true)}
                emptyIsSetup={false}
              />
            </TabsContent>
          </Tabs>
        ) : (
          myPanel
        )}
      </div>
    </>
  );
}

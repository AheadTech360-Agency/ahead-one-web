/*
 * Typed fixtures (generated API shapes) for the development preview at /dev/connected-apps, which
 * returns 404 in production builds.
 */
import type { OauthGrant, OauthRequestInfo } from "@/lib/api/types";

const sc = (scope: string, description: string, write: boolean) => ({ scope, description, write, default_on: !write });

export const FIXTURE_SCOPES = [
  sc("messages:read", "Read your messages and channels", false),
  sc("tasks:read", "Read your tasks and projects", false),
  sc("files:read", "Read files you can access", false),
  sc("brief:read", "Read your daily brief", false),
  sc("team:read", "Read who is on the team", false),
  sc("messages:write", "Send messages as you", true),
  sc("tasks:write", "Create and update tasks", true),
  sc("files:attach", "Attach files to tasks", true),
];

const WS = [{ id: "w1", name: "AheadTech360", role: "member" as const }];

export const FIXTURE_REQUEST: OauthRequestInfo = {
  client_name: "Claude",
  redirect_host: "claude.ai",
  unverified: true,
  scopes: FIXTURE_SCOPES,
  workspaces: WS,
  expires_at: "2099-01-01T00:00:00Z",
};

export const FIXTURE_UNVERIFIED: OauthRequestInfo = {
  ...FIXTURE_REQUEST,
  client_name: "<img src=x onerror=alert(1)> Helper Agent",
  redirect_host: "127.0.0.1:53682",
};

export const FIXTURE_MULTI: OauthRequestInfo = {
  ...FIXTURE_REQUEST,
  workspaces: [
    { id: "w1", name: "AheadTech360", role: "member" },
    { id: "w2", name: "Northwind Apparel", role: "admin" },
  ],
};

const user = (id: string, name: string, email: string) => ({ id, full_name: name, email, avatar_url: null });
const u1 = user("u1", "Ayesha Khan", "ayesha@example.test");
const u2 = user("u2", "Omar Siddiqui", "omar@example.test");

export const FIXTURE_GRANTS: OauthGrant[] = [
  {
    id: "g1",
    client_name: "Claude",
        workspace_id: "w1",
    scopes: ["messages:read", "tasks:read", "files:read", "tasks:write"],
    created_at: "2026-11-02T09:14:00Z",
    last_used_at: new Date(Date.now() - 12 * 60_000).toISOString(),
    calls_this_week: 184,
    user: u1,
  },
  {
    id: "g2",
    client_name: "Cursor",
        workspace_id: "w1",
    scopes: ["tasks:read", "team:read"],
    created_at: "2026-11-20T15:40:00Z",
    last_used_at: null,
    calls_this_week: 0,
    user: u1,
  },
  {
    id: "g3",
    client_name: "Local agent",
        workspace_id: "w1",
    scopes: ["messages:read", "messages:write"],
    created_at: "2026-11-24T08:02:00Z",
    last_used_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    calls_this_week: 9,
    user: u2,
  },
];

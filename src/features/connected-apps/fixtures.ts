/*
 * Typed fixtures that mirror the planned MCP / OAuth contract (see contract.ts). Imported only by the
 * development preview at /dev/connected-apps, which returns 404 in production builds.
 */
import type { OAuthGrant, OAuthRequestInfo } from "./contract";

export const FIXTURE_SCOPES = [
  { id: "messages:read", description: "Read your messages and channels" },
  { id: "tasks:read", description: "Read your tasks and projects" },
  { id: "files:read", description: "Read files you can access" },
  { id: "brief:read", description: "Read your daily brief" },
  { id: "team:read", description: "Read who is on the team" },
  { id: "messages:write", description: "Send messages as you" },
  { id: "tasks:write", description: "Create and update tasks" },
  { id: "files:attach", description: "Attach files to tasks" },
];

export const FIXTURE_REQUEST: OAuthRequestInfo = {
  id: "fixture-request-id",
  client_name: "Claude",
  client_id: "claude-ai",
  redirect_uri: "https://claude.ai/api/mcp/auth_callback",
  redirect_host: "claude.ai",
  scopes: FIXTURE_SCOPES,
  unverified: false,
  expires_at: "2099-01-01T00:00:00Z",
};

export const FIXTURE_UNVERIFIED: OAuthRequestInfo = {
  ...FIXTURE_REQUEST,
  client_name: "<img src=x onerror=alert(1)> Helper Agent",
  client_id: "dyn-4f1c",
  redirect_uri: "http://127.0.0.1:53682/callback",
  redirect_host: "127.0.0.1:53682",
  unverified: true,
};

const user = (id: string, name: string, email: string) => ({ id, full_name: name, email, avatar_url: null });
const u1 = user("u1", "Ayesha Khan", "ayesha@example.test");
const u2 = user("u2", "Omar Siddiqui", "omar@example.test");

export const FIXTURE_GRANTS: OAuthGrant[] = [
  {
    id: "g1",
    client_name: "Claude",
    client_id: "claude-ai",
    unverified: false,
    scopes: ["messages:read", "tasks:read", "files:read", "tasks:write"],
    created_at: "2026-11-02T09:14:00Z",
    last_used_at: new Date(Date.now() - 12 * 60_000).toISOString(),
    calls_this_week: 184,
    user: u1,
  },
  {
    id: "g2",
    client_name: "Cursor",
    client_id: "cursor",
    unverified: false,
    scopes: ["tasks:read", "team:read"],
    created_at: "2026-11-20T15:40:00Z",
    last_used_at: null,
    calls_this_week: 0,
    user: u1,
  },
  {
    id: "g3",
    client_name: "Local agent",
    client_id: "dyn-91ab",
    unverified: true,
    scopes: ["messages:read", "messages:write"],
    created_at: "2026-11-24T08:02:00Z",
    last_used_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    calls_this_week: 9,
    user: u2,
  },
];

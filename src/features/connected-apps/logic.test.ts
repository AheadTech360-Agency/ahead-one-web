import assert from "node:assert/strict";
import { test } from "node:test";
import {
  JSON_SNIPPET,
  MCP_URL,
  allowSummary,
  canAllow,
  canRevoke,
  canSeeEveryonesApps,
  defaultSelection,
  groupScopes,
  isExpired,
  isSafeRedirect,
  lastUsedLabel,
  orderLike,
  pickWorkspace,
  requestProblem,
  scopeGroup,
  scopeLabel,
  toggleScope,
} from "./logic.ts";

const s = (scope: string, description: string, write: boolean) => ({ scope, description, write, default_on: !write });
const scopes = [
  s("messages:read", "Read messages", false),
  s("tasks:read", "Read tasks", false),
  s("files:read", "Read files", false),
  s("messages:write", "Send messages", true),
  s("tasks:write", "Create and update tasks", true),
  s("files:attach", "Attach files", true),
];

test("redirect: https, loopback http and custom schemes whose host matches what the user saw", () => {
  assert.equal(isSafeRedirect("https://claude.ai/api/mcp/auth_callback?code=abc&state=xyz", "claude.ai"), true);
  assert.equal(isSafeRedirect("http://127.0.0.1:53682/callback?code=1", "127.0.0.1:53682"), true);
  assert.equal(isSafeRedirect("http://localhost:3000/cb?error=access_denied", "localhost:3000"), true);
  assert.equal(isSafeRedirect("http://[::1]:9/cb?code=1", "[::1]:9"), true);
  assert.equal(isSafeRedirect("cursor://anysphere.cursor-retrieval/oauth/callback?code=1", "cursor://"), true);
  assert.equal(isSafeRedirect("com.example.app:/oauth2redirect?code=1", "com.example.app://"), true);
});

test("redirect: never trusts anything else", () => {
  const host = "claude.ai";
  const bad = [
    "https://evil.example/api/mcp/auth_callback?code=1", // other host
    "https://claude.ai.evil.example/x",
    "https://claude.ai:8443/x", // other port
    "http://claude.ai/api/mcp/auth_callback?code=1", // plain http to a real host
    "javascript:alert(1)",
    "data:text/html,<script>1</script>",
    "file:///etc/passwd",
    "//evil.example/x",
    "/relative",
    "https://user:pw@claude.ai/x",
    "https://claude.ai/x#frag",
    "https://claude.ai/x\n?code=1",
    "https://claude.ai\\@evil.example/",
    "",
    "not a url",
  ];
  for (const b of bad) assert.equal(isSafeRedirect(b, host), false, b);
  assert.equal(isSafeRedirect(undefined, host), false);
  assert.equal(isSafeRedirect(42, host), false);
  assert.equal(isSafeRedirect("https://claude.ai/x", ""), false);
  // A scripting scheme can never match, even if the API claimed it as the host.
  assert.equal(isSafeRedirect("javascript:alert(1)", "javascript://"), false);
  // Custom scheme must match the announced scheme.
  assert.equal(isSafeRedirect("evil://x/cb", "cursor://"), false);
  // Loopback must match the announced port, and a look-alike host is not loopback.
  assert.equal(isSafeRedirect("http://127.0.0.1:9999/callback", "127.0.0.1:53682"), false);
  assert.equal(isSafeRedirect("http://127.0.0.1.evil.example/cb", "127.0.0.1.evil.example"), false);
});

test("scope groups and defaults: read on, write off", () => {
  assert.equal(scopeGroup("tasks:read"), "read");
  assert.equal(scopeGroup("files:attach"), "write");
  const g = groupScopes(scopes);
  assert.equal(g.read.length, 3);
  assert.equal(g.write.length, 3);
  assert.deepEqual(defaultSelection(scopes), ["messages:read", "tasks:read", "files:read"]);
  // Even if the API ever marked a write scope default_on, it is not ticked.
  assert.deepEqual(defaultSelection([{ scope: "x:write", description: "", write: true, default_on: true }]), []);
});

test("toggle keeps request order, ignores unknown scopes, never invents one", () => {
  let sel = defaultSelection(scopes);
  sel = toggleScope(sel, "messages:write", scopes);
  assert.deepEqual(sel, ["messages:read", "tasks:read", "files:read", "messages:write"]);
  sel = toggleScope(sel, "tasks:read", scopes);
  assert.ok(!sel.includes("tasks:read"));
  assert.deepEqual(toggleScope(sel, "admin:everything", scopes), sel);
  assert.deepEqual(orderLike(["tasks:write", "nope", "tasks:write", "messages:read"], scopes), ["messages:read", "tasks:write"]);
});

test("at least one scope is required", () => {
  assert.equal(canAllow([], scopes), false);
  assert.equal(canAllow(["unknown"], scopes), false);
  assert.equal(canAllow(["tasks:read"], scopes), true);
  assert.match(allowSummary([], scopes), /at least one/);
  assert.equal(allowSummary(["tasks:read"], scopes), "1 permission selected");
  assert.equal(allowSummary(["tasks:read", "files:read"], scopes), "2 permissions selected");
});

test("workspace choice: first by default, a chosen one only if offered", () => {
  const ws = [{ id: "a" }, { id: "b" }];
  assert.equal(pickWorkspace(ws, undefined), "a");
  assert.equal(pickWorkspace(ws, "b"), "b");
  assert.equal(pickWorkspace(ws, "zzz"), "a");
  assert.equal(pickWorkspace([], "a"), undefined);
});

test("role gating: only the Owner sees everyone's apps; anyone revokes their own", () => {
  assert.equal(canSeeEveryonesApps("owner"), true);
  for (const r of ["admin", "management", "member", "guest", undefined] as const) assert.equal(canSeeEveryonesApps(r), false);
  assert.equal(canRevoke("member", "u1", "u1"), true);
  assert.equal(canRevoke("member", "u2", "u1"), false);
  assert.equal(canRevoke("admin", "u2", "u1"), false);
  assert.equal(canRevoke("owner", "u2", "u1"), true);
  assert.equal(canRevoke("owner", "u2", undefined), false);
});

test("request problems", () => {
  assert.equal(requestProblem(410), "expired");
  assert.equal(requestProblem(404), "invalid");
  assert.equal(requestProblem(403), "forbidden");
  assert.equal(requestProblem(0), "network");
  assert.equal(isExpired("2020-01-01T00:00:00Z", Date.parse("2020-01-01T00:00:01Z")), true);
  assert.equal(isExpired("2030-01-01T00:00:00Z", Date.parse("2020-01-01T00:00:01Z")), false);
});

test("setup snippets carry the MCP url and no secret", () => {
  assert.equal(MCP_URL, "https://ahead-one-api-production.up.railway.app/mcp");
  assert.equal(JSON.parse(JSON_SNIPPET).mcpServers["ahead-one"].url, MCP_URL);
});

test("last used copy", () => {
  const now = Date.parse("2026-11-27T12:00:00Z");
  assert.equal(lastUsedLabel(null, now), "Never used");
  assert.equal(lastUsedLabel("2026-11-27T11:59:30Z", now), "Just now");
  assert.equal(lastUsedLabel("2026-11-27T11:30:00Z", now), "30 min ago");
  assert.equal(lastUsedLabel("2026-11-27T09:00:00Z", now), "3 hours ago");
  assert.equal(lastUsedLabel("2026-11-26T09:00:00Z", now), "Yesterday");
});

test("scope labels", () => {
  assert.equal(scopeLabel("tasks:read"), "Read tasks");
  assert.equal(scopeLabel("files.attach"), "Attach files");
  assert.equal(scopeLabel("<b>x</b>"), "<b>x</b>");
});

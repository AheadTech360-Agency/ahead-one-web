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
  displayHost,
  groupScopes,
  isExpired,
  isSafeRedirect,
  lastUsedLabel,
  orderLike,
  requestProblem,
  scopeLabel,
  scopeGroup,
  toggleScope,
} from "./logic.ts";

const scopes = [
  { id: "messages:read", description: "Read messages" },
  { id: "tasks:read", description: "Read tasks" },
  { id: "files:read", description: "Read files" },
  { id: "messages:write", description: "Send messages" },
  { id: "tasks:write", description: "Create and update tasks" },
  { id: "files:attach", description: "Attach files" },
];

test("redirect: https, loopback http and custom schemes that match the registered client", () => {
  const reg = "https://claude.ai/api/mcp/auth_callback";
  assert.equal(isSafeRedirect("https://claude.ai/api/mcp/auth_callback?code=abc&state=xyz", reg), true);
  const loop = "http://127.0.0.1:53682/callback";
  assert.equal(isSafeRedirect("http://127.0.0.1:53682/callback?code=1", loop), true);
  assert.equal(isSafeRedirect("http://localhost:3000/cb?error=access_denied", "http://localhost:3000/cb"), true);
  assert.equal(isSafeRedirect("http://[::1]:9/cb?code=1", "http://[::1]:9/cb"), true);
  const custom = "cursor://anysphere.cursor-retrieval/oauth/callback";
  assert.equal(isSafeRedirect(`${custom}?code=1`, custom), true);
  assert.equal(isSafeRedirect("com.example.app:/oauth2redirect?code=1", "com.example.app:/oauth2redirect"), true);
});

test("redirect: never trusts anything else", () => {
  const reg = "https://claude.ai/api/mcp/auth_callback";
  const bad = [
    "https://evil.example/api/mcp/auth_callback?code=1", // other host
    "https://claude.ai/other?code=1", // other path
    "http://claude.ai/api/mcp/auth_callback?code=1", // plain http to a real host
    "javascript:alert(1)",
    "data:text/html,<script>1</script>",
    "file:///etc/passwd",
    "//evil.example/x",
    "/relative",
    "https://user:pw@claude.ai/api/mcp/auth_callback",
    "https://claude.ai/api/mcp/auth_callback#frag",
    "https://claude.ai/api/mcp/auth_callback\n?code=1",
    "https://claude.ai\\@evil.example/",
    "",
    "not a url",
  ];
  for (const b of bad) assert.equal(isSafeRedirect(b, reg), false, b);
  assert.equal(isSafeRedirect(undefined, reg), false);
  assert.equal(isSafeRedirect(42, reg), false);
  assert.equal(isSafeRedirect("https://claude.ai/api/mcp/auth_callback", "garbage"), false);
  // A registered javascript: URI can never be satisfied.
  assert.equal(isSafeRedirect("javascript:alert(1)", "javascript:alert(1)"), false);
  // Loopback http must still match the registered port.
  assert.equal(isSafeRedirect("http://127.0.0.1:9999/callback", "http://127.0.0.1:53682/callback"), false);
  // Look-alike loopback host is not loopback.
  assert.equal(isSafeRedirect("http://127.0.0.1.evil.example/cb", "http://127.0.0.1.evil.example/cb"), false);
});

test("display host", () => {
  assert.equal(displayHost("https://claude.ai/api/cb", "x"), "claude.ai");
  assert.equal(displayHost("http://localhost:3000/cb", "x"), "localhost:3000");
  assert.equal(displayHost("cursor://anysphere.cursor/cb", "x"), "anysphere.cursor");
  assert.equal(displayHost("com.example.app:/cb", "x"), "com.example.app://");
});

test("scope groups and defaults: read on, write off", () => {
  assert.equal(scopeGroup("tasks:read"), "read");
  assert.equal(scopeGroup("tasks:write"), "write");
  assert.equal(scopeGroup("files:attach"), "write");
  const g = groupScopes(scopes);
  assert.equal(g.read.length, 3);
  assert.equal(g.write.length, 3);
  assert.deepEqual(defaultSelection(scopes), ["messages:read", "tasks:read", "files:read"]);
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
  assert.equal(requestProblem(400), "invalid");
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

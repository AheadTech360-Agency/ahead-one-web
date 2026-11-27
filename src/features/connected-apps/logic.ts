/*
 * Pure rules for OAuth consent and connected apps: redirect validation, scope selection, grouping,
 * role gating and the setup snippets. No React and no "@/" value imports, so `npm test` runs it
 * under node:test.
 */

export const MCP_URL = "https://ahead-one-api-production.up.railway.app/mcp";
export const DOCS_URL = "https://ahead-one-api-production.up.railway.app/docs/mcp";

/* ---------- redirect validation ---------- */

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
/** Schemes that run code or are never an app callback, even though they are "custom". */
const FORBIDDEN_SCHEMES = new Set([
  "javascript:", "data:", "vbscript:", "file:", "blob:", "about:", "ftp:", "ws:", "wss:", "chrome:", "view-source:", "intent:",
]);

function parse(u: string): URL | null {
  try {
    return new URL(u);
  } catch {
    return null;
  }
}

/** The host the API reports for a redirect: "host[:port]" for http(s), "scheme://" for custom schemes. */
function hostOf(u: URL): string {
  return u.protocol === "https:" || u.protocol === "http:" ? u.host : `${u.protocol}//`;
}

/** Control characters, whitespace, no-break space and backslashes: browsers treat some of these as separators. */
function hasUnsafeChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0x20 || (c >= 0x7f && c <= 0xa0) || c === 0x5c) return true;
  }
  return false;
}

/**
 * Whether the browser may be sent to `candidate` after the user decided. The API returns the app's
 * registered redirect with `code`/`state` or `error` in the query; the consent info only carries its
 * host (`redirect_host`), so that is what is checked, together with the scheme rules. Accepted: https,
 * http on a loopback host, or a custom app scheme (`cursor://`, `com.example.app:`). Rejected:
 * credentials in the URL, fragments, scripting and file schemes, plain http to a real host, control
 * characters and backslashes, and any destination whose host differs from the one shown to the user.
 */
export function isSafeRedirect(candidate: unknown, redirectHost: string): boolean {
  if (typeof candidate !== "string" || candidate.length === 0 || candidate.length > 4096) return false;
  if (!redirectHost) return false;
  if (hasUnsafeChar(candidate)) return false;
  const url = parse(candidate);
  if (!url) return false;
  if (url.username || url.password || url.hash) return false;
  if (FORBIDDEN_SCHEMES.has(url.protocol)) return false;
  if (url.protocol === "https:") {
    // ok
  } else if (url.protocol === "http:") {
    if (!LOOPBACK.has(url.hostname)) return false;
  } else if (!/^[a-z][a-z0-9+.-]*:$/.test(url.protocol)) {
    return false;
  }
  return hostOf(url) === redirectHost;
}

/* ---------- scopes ---------- */

export type ScopeGroup = "read" | "write";

/** Heuristic for a bare scope id (used for the chips on a grant, which carry no `write` flag). */
export function scopeGroup(id: string): ScopeGroup {
  return /(write|send|create|update|attach|manage)/i.test(id) ? "write" : "read";
}

/** The consent info's ScopeInfo, structurally (kept local so this file stays free of "@/" imports). */
export type ScopeLike = { scope: string; description: string; write: boolean; default_on: boolean };

export function groupScopes<T extends ScopeLike>(scopes: readonly T[]): { read: T[]; write: T[] } {
  const out = { read: [] as T[], write: [] as T[] };
  for (const s of scopes) out[s.write ? "write" : "read"].push(s);
  return out;
}

/** What the API says is on by default; a write scope is never ticked here. */
export function defaultSelection(scopes: readonly ScopeLike[]): string[] {
  return scopes.filter((s) => s.default_on && !s.write).map((s) => s.scope);
}

export function toggleScope(selected: readonly string[], id: string, requested: readonly ScopeLike[]): string[] {
  if (!requested.some((s) => s.scope === id)) return [...selected];
  const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
  return orderLike(next, requested);
}

/** What is actually sent: only requested scopes, in the order they were requested, no duplicates. */
export function orderLike(selected: readonly string[], requested: readonly ScopeLike[]): string[] {
  const set = new Set(selected);
  return requested.map((s) => s.scope).filter((id) => set.has(id));
}

/** At least one scope is required to allow. */
export function canAllow(selected: readonly string[], requested: readonly ScopeLike[]): boolean {
  return orderLike(selected, requested).length > 0;
}

/** The workspace to send: the chosen one if it is offered, else the first. Undefined when there is none. */
export function pickWorkspace<T extends { id: string }>(workspaces: readonly T[], chosen: string | undefined): string | undefined {
  if (workspaces.length === 0) return undefined;
  return workspaces.find((w) => w.id === chosen)?.id ?? workspaces[0]!.id;
}

export function allowSummary(selected: readonly string[], requested: readonly ScopeLike[]): string {
  const n = orderLike(selected, requested).length;
  if (n === 0) return "Choose at least one permission to allow.";
  return n === 1 ? "1 permission selected" : `${n} permissions selected`;
}

/** "tasks:read" becomes "Read tasks". Unknown shapes are shown as they are (as text). */
export function scopeLabel(id: string): string {
  const m = /^([a-z_]+)[:.]([a-z_]+)$/i.exec(id);
  if (!m) return id;
  const verb = m[2]!.replace(/_/g, " ");
  return `${verb.charAt(0).toUpperCase()}${verb.slice(1)} ${m[1]!.replace(/_/g, " ")}`;
}

/* ---------- role gating ---------- */

export type Role = "owner" | "admin" | "management" | "member" | "guest";

/** The "Everyone's apps" tab and its revoke buttons are for the Owner only. */
export function canSeeEveryonesApps(role: Role | undefined): boolean {
  return role === "owner";
}

/** Whether a grant row may be revoked by this viewer: your own always, anyone's only as Owner. */
export function canRevoke(role: Role | undefined, grantUserId: string, meId: string | undefined): boolean {
  if (!meId) return false;
  return grantUserId === meId || canSeeEveryonesApps(role);
}

/* ---------- request state ---------- */

export type RequestProblem = "expired" | "invalid" | "network" | "forbidden";

/** Maps an API failure on the request lookup to a state the consent page can explain. */
export function requestProblem(status: number | undefined): RequestProblem {
  if (status === 410) return "expired";
  if (status === 404 || status === 400) return "invalid";
  if (status === 403) return "forbidden";
  return "network";
}

export function isExpired(expiresAt: string, now = Date.now()): boolean {
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t <= now;
}

/* ---------- setup snippets ---------- */

export const CLAUDE_CODE_SNIPPET = `claude mcp add --transport http ahead-one ${MCP_URL}`;

export const JSON_SNIPPET = JSON.stringify(
  { mcpServers: { "ahead-one": { url: MCP_URL } } },
  null,
  2,
);

/** "Last used" copy: never claims a time it does not have. */
export function lastUsedLabel(lastUsedAt: string | null, now = Date.now()): string {
  if (!lastUsedAt) return "Never used";
  const t = Date.parse(lastUsedAt);
  if (!Number.isFinite(t)) return "Never used";
  const mins = Math.floor((now - t) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? "Yesterday" : `${days} days ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

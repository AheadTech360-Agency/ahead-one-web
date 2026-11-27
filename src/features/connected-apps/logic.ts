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

/** Origin-like identity of a URL for comparing against the registered redirect (scheme, host, port, path). */
function identity(u: URL): string {
  return `${u.protocol}//${u.host}${u.pathname}`;
}

/**
 * Whether the browser may be sent to `candidate` after the user decided. The API returns the
 * redirect with `code`/`state` or `error` in the query, so the query may differ; everything else
 * must equal the registered redirect URI. Accepted: https, http on a loopback host, or a custom app
 * scheme (reverse-DNS style, for example `cursor://` or `com.example.app:`). Rejected: credentials in
 * the URL, fragments, scripting and file schemes, plain http to a real host, and anything that does
 * not match the registered client.
 */
export function isSafeRedirect(candidate: unknown, registered: string): boolean {
  if (typeof candidate !== "string" || candidate.length === 0 || candidate.length > 4096) return false;
  if (/[\u0000- \u007f- \\]/.test(candidate)) return false;
  const url = parse(candidate);
  const reg = parse(registered);
  if (!url || !reg) return false;
  if (url.username || url.password || url.hash) return false;
  if (FORBIDDEN_SCHEMES.has(url.protocol)) return false;
  const scheme = url.protocol;
  if (scheme === "https:") {
    // ok
  } else if (scheme === "http:") {
    if (!LOOPBACK.has(url.hostname)) return false;
  } else if (!/^[a-z][a-z0-9+.-]*:$/.test(scheme) || scheme === "http:" || scheme === "https:") {
    return false;
  }
  return identity(url) === identity(reg);
}

/** The destination host shown prominently on the consent screen, taken from the registered URI. */
export function displayHost(registered: string, apiHost: string): string {
  const u = parse(registered);
  if (!u) return apiHost || "unknown";
  if (u.host) return u.host;
  // Custom scheme without a host: show the scheme, which is what identifies the app on the device.
  return `${u.protocol}//`;
}

/* ---------- scopes ---------- */

export type ScopeGroup = "read" | "write";

/** Scope ids look like "tasks:read" or "tasks.write"; anything containing "write", "send", "create", "update" or "attach" is a write. */
export function scopeGroup(id: string): ScopeGroup {
  return /(write|send|create|update|attach|manage)/i.test(id) ? "write" : "read";
}

export type ScopeLike = { id: string; description: string };

export function groupScopes<T extends ScopeLike>(scopes: readonly T[]): { read: T[]; write: T[] } {
  const out = { read: [] as T[], write: [] as T[] };
  for (const s of scopes) out[scopeGroup(s.id)].push(s);
  return out;
}

/** Read scopes start ON, write scopes OFF. */
export function defaultSelection(scopes: readonly ScopeLike[]): string[] {
  return scopes.filter((s) => scopeGroup(s.id) === "read").map((s) => s.id);
}

export function toggleScope(selected: readonly string[], id: string, requested: readonly ScopeLike[]): string[] {
  if (!requested.some((s) => s.id === id)) return [...selected];
  const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
  return orderLike(next, requested);
}

/** What is actually sent: only requested scopes, in the order they were requested, no duplicates. */
export function orderLike(selected: readonly string[], requested: readonly ScopeLike[]): string[] {
  const set = new Set(selected);
  return requested.map((s) => s.id).filter((id) => set.has(id));
}

/** At least one scope is required to allow. */
export function canAllow(selected: readonly string[], requested: readonly ScopeLike[]): boolean {
  return orderLike(selected, requested).length > 0;
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

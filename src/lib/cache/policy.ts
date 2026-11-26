/*
 * Pure rules for the persisted query cache. No React, no browser APIs and no "@/" imports, so
 * `npm test` can run them under node:test. The IndexedDB plumbing lives in persister.ts.
 *
 * What may be written to disk is decided by an allowlist of query-key shapes. Anything not on it
 * (search, audit log, invites, signed attachment URLs, upload tickets) never leaves memory, and a
 * second check refuses any payload that contains a token-shaped field. The refresh token never
 * reaches JavaScript and the access token is not in the query cache, so neither can end up here.
 */

/** Bump when a cached response shape changes in a way the API-contract version does not capture. */
export const CACHE_SCHEMA = "1";

/** A restored cache older than this is thrown away. In-memory gcTime stays shorter. */
export const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Trailing throttle between IndexedDB writes. */
export const PERSIST_THROTTLE_MS = 1_000;

/** Cache buster: the schema version plus the build, so a deploy never reads a previous build's shapes. */
export function cacheBuster(build: string | undefined): string {
  return `${CACHE_SCHEMA}:${build || "local"}`;
}

type Key = readonly unknown[];

const WS_KINDS = new Set(["members", "tree", "conversations", "dashboard", "my-tasks"]);
const CHAT_KINDS = new Set(["detail", "messages", "members", "read-states"]);
const NOTIFICATION_KINDS = new Set(["list", "unread-count"]);

/** True when a query with this key may be persisted. */
export function isPersistableKey(key: Key): boolean {
  const [root, second, third, fourth] = key;
  switch (root) {
    case "me":
    case "roles":
      return true;
    case "ws":
      if (typeof second !== "string" || !second) return false;
      if (typeof third !== "string") return false;
      if (WS_KINDS.has(third)) return true;
      // Files: only the small summary card, never the list (which carries per-file metadata).
      // The app-release keys (release metadata and its signed download link) are deliberately NOT here.
      return third === "files" && fourth === "summary";
    case "project":
      // ["project", id], ["project", id, "members"], ["project", id, "lists"]
      return typeof second === "string" && (third === undefined || third === "members" || third === "lists");
    case "list":
      return typeof second === "string" && third === "statuses";
    case "tasks":
    case "task":
    case "task-comments":
    case "task-activity":
      return typeof second === "string";
    case "chat":
      return typeof second === "string" && typeof third === "string" && CHAT_KINDS.has(third);
    case "notifications":
      return typeof second === "string" && NOTIFICATION_KINDS.has(second);
    default:
      return false;
  }
}

/** Field names that must never be written to disk, whatever query they appear in. */
const SECRET_FIELD = /^(access_token|refresh_token|id_token|token|password|passcode|secret|client_secret|api_key|upload_url|download_url|signed_url)$/i;

/**
 * Defence in depth: true when any object in `data` has a secret-shaped field name. Walks at most
 * `limit` nodes so a very large payload costs a bounded amount of work (past the limit the data is
 * treated as unsafe and stays in memory).
 */
export function hasSecretShape(data: unknown, limit = 200_000): boolean {
  const stack: unknown[] = [data];
  let seen = 0;
  while (stack.length) {
    const v = stack.pop();
    if (v === null || typeof v !== "object") continue;
    if (++seen > limit) return true;
    if (Array.isArray(v)) {
      for (const x of v) stack.push(x);
      continue;
    }
    for (const k of Object.keys(v)) {
      if (SECRET_FIELD.test(k)) return true;
      stack.push((v as Record<string, unknown>)[k]);
    }
  }
  return false;
}

type QueryLike = {
  queryKey: Key;
  state: { status: string; data?: unknown };
  meta?: Record<string, unknown> | undefined;
};

/** dehydrateOptions.shouldDehydrateQuery. */
export function shouldPersistQuery(q: QueryLike): boolean {
  if (q.state.status !== "success") return false;
  if (q.meta?.persist === false) return false;
  if (!isPersistableKey(q.queryKey)) return false;
  return !hasSecretShape(q.state.data);
}

/* ---------- Scope: one signed-in user per cache ---------- */

export type ScopeDecision = "adopt" | "keep" | "wipe";

/**
 * What to do once the live `/v1/me` names the signed-in user.
 * - `adopt`: nothing was restored (or it had no owner), so this user owns the cache from now on.
 * - `keep`: the restored cache belongs to this user.
 * - `wipe`: the restored cache belongs to someone else; drop it.
 */
export function decideScope(restoredUserId: string | null | undefined, currentUserId: string): ScopeDecision {
  if (!restoredUserId) return "adopt";
  return restoredUserId === currentUserId ? "keep" : "wipe";
}

/* ---------- Restore validation ---------- */

export type PersistedRecord<C> = {
  userId: string | null;
  buster: string;
  timestamp: number;
  client: C;
};

function isRecord(v: unknown): v is PersistedRecord<unknown> {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.buster === "string" &&
    typeof r.timestamp === "number" &&
    (r.userId === null || typeof r.userId === "string") &&
    !!r.client &&
    typeof r.client === "object"
  );
}

/** A stored record is restored only when it is well formed, from this build, not expired and owned by someone. */
export function restorableRecord<C>(
  raw: unknown,
  opts: { buster: string; now?: number; maxAge?: number },
): PersistedRecord<C> | null {
  if (!isRecord(raw)) return null;
  if (raw.buster !== opts.buster) return null;
  const age = (opts.now ?? Date.now()) - raw.timestamp;
  if (age < 0 || age > (opts.maxAge ?? PERSIST_MAX_AGE_MS)) return null;
  if (!raw.userId) return null;
  return raw as PersistedRecord<C>;
}

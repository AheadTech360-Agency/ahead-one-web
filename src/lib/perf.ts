/*
 * Opt-in request timing so a slow endpoint or a new waterfall is visible while developing.
 * On by default in `next dev`; in production set `localStorage["ahead-one.perf"] = "1"` and reload.
 * Each API call logs `[perf] GET /v1/... 123 ms (200)` and the last 200 are kept for
 * `window.__aheadPerf.table()` (grouped by path, with count, p50 and max). Nothing is sent anywhere.
 */

type Entry = { method: string; path: string; ms: number; status: number; at: number };

const KEEP = 200;
const entries: Entry[] = [];
let enabled: boolean | null = null;

export function perfEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (enabled !== null) return enabled;
  let flag = false;
  try {
    flag = window.localStorage.getItem("ahead-one.perf") === "1";
  } catch {
    // Storage blocked: dev builds only.
  }
  enabled = flag || process.env.NODE_ENV !== "production";
  if (enabled) {
    (window as unknown as { __aheadPerf?: unknown }).__aheadPerf = { entries, table: perfTable, clear: () => void (entries.length = 0) };
  }
  return enabled;
}

/** Strip ids so the same endpoint groups together: /v1/tasks/<id> becomes /v1/tasks/:id. */
export function groupPath(path: string) {
  return path.replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}(?=\/|$)/gi, "/:id");
}

export function recordRequest(method: string, path: string, startedAt: number, status: number) {
  if (!perfEnabled()) return;
  const ms = Math.round(performance.now() - startedAt);
  entries.push({ method, path, ms, status, at: Date.now() });
  if (entries.length > KEEP) entries.shift();
  console.debug(`[perf] ${method} ${path} ${ms} ms (${status || "network error"})`);
}

export function perfTable() {
  const by = new Map<string, number[]>();
  for (const e of entries) {
    const k = `${e.method} ${groupPath(e.path)}`;
    by.set(k, [...(by.get(k) ?? []), e.ms]);
  }
  const rows = [...by].map(([endpoint, list]) => {
    const sorted = [...list].sort((a, b) => a - b);
    return { endpoint, count: list.length, p50: sorted[Math.floor(sorted.length / 2)], max: sorted[sorted.length - 1] };
  });
  rows.sort((a, b) => b.max - a.max);
  console.table(rows);
  return rows;
}

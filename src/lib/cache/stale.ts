/*
 * Per-resource freshness. TanStack Query serves cached data at once (stale-while-revalidate) and
 * refetches in the background only when the data is older than its staleTime.
 *
 * - STABLE: changes rarely (people, statuses, profile). Minutes.
 * - SEMI: changes occasionally and is edited in place by mutations (sidebar tree, project, lists).
 * - LIVE: lists and tasks other people edit. Seconds; refetched on mount and window focus.
 * - REALTIME: kept current by the WebSocket (messages, conversation list); a refetch is only a safety net.
 */
export const STALE = {
  STABLE: 5 * 60_000,
  SEMI: 2 * 60_000,
  /** Who is on the team or a project: people join and leave, and pickers must not miss a new teammate for long. */
  PEOPLE: 30_000,
  DASHBOARD: 30_000,
  LIVE: 15_000,
  REALTIME: 5 * 60_000,
  FOREVER: Infinity,
} as const;

/** In-memory retention for unobserved queries. The persisted copy lives longer (PERSIST_MAX_AGE_MS). */
export const GC_TIME = 30 * 60_000;

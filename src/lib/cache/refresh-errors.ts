/*
 * Pure logic for the shared "a background refresh failed" notice. No React and no "@/" imports, so
 * node:test can run it. The QueryCache reports every failed fetch here; only failures that happen
 * while cached data is on screen are announced, and a burst of them becomes one notice.
 */

export type RefreshFailureKind = "offline" | "failed";

/** Auth failures are handled by sign-out; cancelled and paused fetches are not failures. */
export function classifyFailure(input: {
  hasData: boolean;
  online: boolean;
  status?: number;
  code?: string;
}): RefreshFailureKind | null {
  if (!input.hasData) return null; // no cached data: the screen shows its own inline error with Retry
  if (input.status === 401 || input.code === "mfa_required" || input.code === "account_disabled") return null;
  if (input.status === 403 || input.status === 404) return null; // access changes are not transient refresh trouble
  return input.online ? "failed" : "offline";
}

/**
 * Lets one notice through per `windowMs` for each kind. Failures inside the window are dropped, so
 * ten queries failing together show one message. `reset(kind)` re-arms it (the notice was dismissed or a refresh worked).
 */
export function createNoticeGate(windowMs: number, now: () => number = Date.now) {
  const last = new Map<RefreshFailureKind, number>();
  return {
    allow(kind: RefreshFailureKind): boolean {
      const t = now();
      const prev = last.get(kind);
      if (prev !== undefined && t - prev < windowMs) return false;
      last.set(kind, t);
      return true;
    },
    reset(kind?: RefreshFailureKind) {
      if (kind) last.delete(kind);
      else last.clear();
    },
  };
}

type Listener = (kind: RefreshFailureKind) => void;
const listeners = new Set<Listener>();

export function onRefreshFailure(fn: Listener) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
export function emitRefreshFailure(kind: RefreshFailureKind) {
  listeners.forEach((l) => l(kind));
}

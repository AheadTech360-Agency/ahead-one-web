/*
 * Pure rules for the Android app download. No React and no "@/" imports, so node:test can run them.
 */

/** Roles that may see the Android download. Guests never do. */
const TEAM_ROLES = new Set(["owner", "admin", "management", "member"]);

/** True for the roles the API serves the release to. Guests get 404 there, so the UI hides the feature and never asks. */
export function canSeeAppRelease(role: string | undefined): boolean {
  return role !== undefined && TEAM_ROLES.has(role);
}

const R2_SUFFIX = ".r2.cloudflarestorage.com";

/**
 * The signed download link is only followed when it is https and on the R2 endpoint. Anything else
 * (http, other hosts, lookalikes such as `evil.com/.r2.cloudflarestorage.com`, credentials in the
 * URL, unparsable strings) is refused.
 */
export function isAllowedDownloadUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 4096) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  return host.length > R2_SUFFIX.length && host.endsWith(R2_SUFFIX);
}

/** Human readable size with binary steps, one decimal from MB up: 52428800 -> "50.0 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/** "Nov 26, 2026". `timeZone` is for tests; the app uses the viewer's zone. */
export function formatPublished(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone }).format(d);
}

/** First 8 and last 8 hex characters joined by an ellipsis; short or odd input is returned as is. */
export function truncateSha(sha: string): string {
  return sha.length > 20 ? `${sha.slice(0, 8)}…${sha.slice(-8)}` : sha;
}

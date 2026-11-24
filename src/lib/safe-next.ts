/**
 * Only allow same-origin relative paths as post-login destinations (no open redirects).
 * Control characters and backslashes are rejected outright: browsers strip tabs and line breaks from
 * URLs and treat "\" like "/", so "/<TAB>/evil.com" or "/\evil.com" would otherwise resolve to an
 * external origin.
 */
const UNSAFE_CHARS = new RegExp("[\\u0000-\\u001f\\u007f\\\\]");

export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || next.length > 2048) return fallback;
  if (UNSAFE_CHARS.test(next)) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  try {
    return new URL(next, "http://placeholder.invalid").origin === "http://placeholder.invalid" ? next : fallback;
  } catch {
    return fallback;
  }
}

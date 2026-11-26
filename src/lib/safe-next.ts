/**
 * The one place that decides what an internal link is. Used for the post-login destination and for
 * every server-supplied target (notification `link`, push payload, deep links, service worker click;
 * the worker embeds this very function through `safeNext.toString()`).
 *
 * Accepted: a relative path starting with a single "/", at most 2048 characters. Rejected outright:
 * control characters, whitespace (browsers strip tabs and line breaks from URLs, so "/<TAB>/evil.com"
 * would resolve to an external origin) and backslashes (treated like "/"). The path must also still
 * be on the same origin after resolving, and neither the path, its dot-segment-resolved form nor its
 * percent-decoded form may start with "//" ("/%2f%2fevil", "/..//evil"), so a later decode or
 * normalise step cannot turn it into a protocol-relative URL.
 *
 * Self-contained on purpose (no module-level constants): see the service worker above.
 */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  const unsafe = new RegExp("[\\u0000-\\u0020\\u007f-\\u00a0\\u2028\\u2029\\\\]");
  const decodedBad = new RegExp("[\\u0000-\\u001f\\u007f\\\\]");
  const base = "http://placeholder.invalid";
  if (!next || next.length > 2048) return fallback;
  if (unsafe.test(next)) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  try {
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    if (url.pathname.startsWith("//")) return fallback;
    let decoded = next;
    for (let i = 0; i < 2; i++) {
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        return fallback;
      }
      if (decoded.startsWith("//") || decodedBad.test(decoded)) return fallback;
    }
    return next;
  } catch {
    return fallback;
  }
}

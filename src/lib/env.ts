/*
 * Public runtime configuration. Only NEXT_PUBLIC_* values belong here: they are inlined
 * into the browser bundle. Never add a secret. Server-only settings (API_INTERNAL_URL) are read
 * directly from process.env in the route handlers.
 * Each variable is referenced literally so Next.js can inline it.
 */

export const env = {
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, ""),
} as const;

export const isApiConfigured = Boolean(env.apiUrl);

import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/** Origin plus its websocket twin for connect-src. Ignores unset or malformed values. */
function origins(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const url = new URL(raw);
    const ws = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`;
    return [url.origin, ws];
  } catch {
    return [];
  }
}

const api = origins(process.env.NEXT_PUBLIC_API_URL);

/*
 * Web push (only when Firebase is configured). The Firebase Messaging SDK's getToken/deleteToken
 * call two Google APIs from the page:
 * - firebaseinstallations.googleapis.com: creates the Firebase installation (FID) and its auth token;
 * - fcmregistrations.googleapis.com: registers the browser's push subscription and returns the FCM token.
 * Push delivery itself goes browser vendor -> service worker and needs no CSP entry.
 */
const firebase = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  ? ["https://firebaseinstallations.googleapis.com", "https://fcmregistrations.googleapis.com"]
  : [];

/*
 * File storage (Cloudflare R2). The browser PUTs uploads to, and plays/downloads files from, signed URLs on
 * the account's R2 endpoint, so it needs connect-src (XHR PUT) and media-src (inline video and audio).
 * Images already load from any https origin (img-src below).
 */
const r2 = "https://*.r2.cloudflarestorage.com";

/*
 * Content Security Policy. Fonts are self-hosted by next/font, so font-src is 'self'.
 * script-src keeps 'unsafe-inline' because Next.js and next-themes inject inline bootstrap
 * scripts; moving to a nonce-based policy (set in proxy.ts) is the planned hardening step.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${[...api, ...firebase, r2].join(" ")}${isDev ? " ws://localhost:* ws://127.0.0.1:*" : ""}`.trim(),
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  `media-src 'self' blob: ${r2}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    // The screen recorder needs display-capture and (optionally) the microphone, for this origin only.
    value: "camera=(), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  // The e2e suite builds into its own folder so it never fights a dev server or build using .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: { position: "bottom-right" },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

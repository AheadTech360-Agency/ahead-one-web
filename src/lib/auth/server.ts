import { NextResponse, type NextRequest } from "next/server";
import type { ApiErrorBody, SessionTokens } from "@/lib/api/types";
import { IS_PROD, REFRESH_COOKIE, REFRESH_MAX_AGE } from "./cookie";
import { CSRF_HEADER, type SessionBody } from "./types";

/*
 * Server-side helpers for the /api/auth/* route handlers (backend for frontend). The refresh
 * token lives only in an httpOnly cookie set here. It is never put in a response body or a log.
 */

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** API base for server-to-server calls: API_INTERNAL_URL (private network) or the public URL. */
export function apiBase() {
  return (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
}

export function errorResponse(status: number, code: string, message: string) {
  const body: ApiErrorBody = { error: { code, message } };
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * CSRF guard for every state-changing handler. A request passes only when:
 * - it carries `x-ahead-csrf: 1`,
 * - its Origin header is present and names this host, and
 * - the browser does not report it as cross-site (Sec-Fetch-Site), when it sends that header.
 * Returns a 403 response to send back, or null when the request may proceed.
 */
export function csrfGuard(req: NextRequest): NextResponse | null {
  const blocked = () => errorResponse(403, "forbidden", "This request was blocked. Reload the page and try again.");
  if (req.headers.get(CSRF_HEADER) !== "1") return blocked();
  const origin = req.headers.get("origin");
  if (!origin) return blocked();
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return blocked();
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  if (originHost !== host) return blocked();
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return blocked();
  return null;
}

type Upstream = { status: number; body: unknown };

/** POST JSON to the API, forwarding the caller's IP chain and user agent so rate limits and session records see the real client. */
export async function callApi(req: NextRequest, path: string, payload: unknown): Promise<Upstream> {
  const base = apiBase();
  if (!base) {
    return { status: 503, body: { error: { code: "unavailable", message: "The API address isn't configured." } } };
  }
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  const xff = req.headers.get("x-forwarded-for");
  if (xff) headers["x-forwarded-for"] = xff;
  // Prove to the API that this call comes from our server, so it can trust the client address we pass
  // (otherwise every user would share this server's address in the rate limits and audit records).
  const secret = process.env.BFF_SECRET;
  if (secret) {
    const client = req.headers.get("x-real-ip") ?? xff?.split(",")[0]?.trim();
    if (client) headers["x-client-ip"] = client;
    headers["x-bff-secret"] = secret;
  }
  const ua = req.headers.get("user-agent");
  if (ua) headers["user-agent"] = ua;
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    return { status: res.status, body };
  } catch {
    return {
      status: 503,
      body: { error: { code: "unavailable", message: "Can't reach the sign-in service. Try again in a moment." } },
    };
  }
}

/** Relay an API error (status and `{error:{code,message}}`) unchanged so the UI can branch on the code. */
export function relayError(up: Upstream) {
  const body =
    up.body && typeof up.body === "object" && "error" in up.body
      ? up.body
      : {
          error: {
            code: up.status === 401 ? "unauthenticated" : "unknown",
            message: "Something went wrong. Try again.",
          },
        };
  return NextResponse.json(body, { status: up.status, headers: NO_STORE });
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const text = await req.text();
    if (text.length > 8_192) return null;
    const v: unknown = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const badBody = () =>
  errorResponse(422, "validation", "That request wasn't valid. Check your details and try again.");

export function str(v: unknown, max = 1024): string | null {
  return typeof v === "string" && v.length <= max ? v : null;
}

const cookieBase = { httpOnly: true, secure: IS_PROD, sameSite: "strict" as const, path: "/" };

export function setRefreshCookie(res: NextResponse, token: string) {
  res.cookies.set({ name: REFRESH_COOKIE, value: token, maxAge: REFRESH_MAX_AGE, ...cookieBase });
}

export function clearRefreshCookie(res: NextResponse) {
  res.cookies.set({ name: REFRESH_COOKIE, value: "", maxAge: 0, ...cookieBase });
}

/**
 * The browser's view of SessionTokens: access token in the body, refresh token in the cookie.
 * A null `refresh_token` (another tab already rotated it) leaves the cookie as it is.
 */
export function sessionResponse(tokens: SessionTokens, extra?: Record<string, unknown>) {
  const body: SessionBody & Record<string, unknown> = {
    ...extra,
    access_token: tokens.access_token,
    expires_in: tokens.expires_in,
    aal: tokens.aal,
  };
  const res = NextResponse.json(body, { headers: NO_STORE });
  if (tokens.refresh_token) setRefreshCookie(res, tokens.refresh_token);
  return res;
}

export function isSessionTokens(v: unknown): v is SessionTokens {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as SessionTokens).access_token === "string" &&
    typeof (v as SessionTokens).expires_in === "number"
  );
}

export const upstreamInvalid = () =>
  errorResponse(502, "internal", "The sign-in service sent an unexpected answer. Try again.");

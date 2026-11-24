"use client";

import { getAccessToken, recoverFromUnauthenticated, signOut } from "@/lib/auth/client";
import { isApiConfigured, env } from "@/lib/env";
import { ApiRequestError, isApiError, errorMessage, parseError } from "./errors";

export { ApiRequestError, isApiError, errorMessage };

type Query = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  /** Skip the Authorization header (public routes such as invite preview). */
  anonymous?: boolean;
  /** Authenticated, but a 401 or 403 is just an error for the caller: no refresh, no sign-out redirect. */
  quiet?: boolean;
};

/**
 * Every API path is `/v1/` plus plain segments (ids, names). Refusing anything else stops a crafted
 * id from a URL, deep link or push payload (`../`, `%2F`, `?`, `#`, backslashes) from steering an
 * authenticated request to a different endpoint (client-side path traversal).
 */
const SAFE_API_PATH = /^\/v1(\/[A-Za-z0-9_-]+)+$/;

export function assertSafeApiPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!SAFE_API_PATH.test(p)) {
    throw new Error("Refused to call an unexpected API path");
  }
  return p;
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(`${env.apiUrl}${assertSafeApiPath(path)}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url;
}

/**
 * Fetch wrapper for the Rust API. Attaches the in-memory access token, parses ApiError bodies into
 * ApiRequestError, and handles auth failures:
 * - 401 `unauthenticated`: refresh the session once and retry; if that fails, sign out and go to /login.
 * - 403 `mfa_required`: sign out and go to /login?reason=mfa so the emailed-code step runs.
 * - 403 `account_disabled`: sign out and go to /login?reason=disabled.
 * 401 `invalid_credentials` and `invalid_code` are ordinary errors (wrong password or code), never a sign-out.
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!isApiConfigured) {
    throw new ApiRequestError(0, "not_configured", "NEXT_PUBLIC_API_URL is not set.");
  }
  const url = buildUrl(path, opts.query);
  const authed = !opts.anonymous;

  let used = authed ? await getAccessToken() : null;
  let res = await send(url, opts, used);
  if (!res.ok && authed && !opts.quiet) {
    let err = await parseError(res);
    if (err.status === 401 && err.code === "unauthenticated") {
      const recovered = await recoverFromUnauthenticated(used);
      if (recovered === "unavailable") throw new ApiRequestError(0, "network", "Network request failed");
      if (recovered === "ok") {
        used = await getAccessToken();
        res = await send(url, opts, used);
        if (res.ok) return readBody<T>(res);
        err = await parseError(res);
      }
      if (err.status === 401 && err.code === "unauthenticated") {
        void signOut({ reason: "expired" });
        throw err;
      }
    }
    if (err.code === "mfa_required") void signOut({ reason: "mfa" });
    else if (err.code === "account_disabled") void signOut({ reason: "disabled" });
    throw err;
  }
  if (!res.ok) throw await parseError(res);
  return readBody<T>(res);
}

async function send(url: URL, opts: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
      credentials: "omit",
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiRequestError(0, "network", "Network request failed");
  }
}

async function readBody<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

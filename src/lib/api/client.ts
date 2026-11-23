"use client";

import { env, isApiConfigured } from "@/lib/env";
import { getSupabase, mfaDestination } from "@/lib/supabase/client";
import type { ApiErrorBody, KnownErrorCode } from "./types";

/** A failed API call, carrying the contract's error code. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: KnownErrorCode | "network" | "not_configured" | "unknown";

  constructor(status: number, code: ApiRequestError["code"], message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }

  get isNotFound() {
    return this.status === 404;
  }
}

export function isApiError(e: unknown): e is ApiRequestError {
  return e instanceof ApiRequestError;
}

/** Plain-language message for an error, suitable for UI copy. */
export function errorMessage(e: unknown, fallback = "Something went wrong. Try again."): string {
  if (isApiError(e)) {
    switch (e.code) {
      case "network":
        return "Can't reach the server. Check your connection and try again.";
      case "not_configured":
        return "The API address isn't configured for this environment.";
      case "forbidden":
        return "You don't have access to this.";
      case "account_disabled":
        return "This account has been disabled. Contact a workspace admin.";
      case "rate_limited":
        return "Too many requests. Wait a moment and try again.";
      case "unavailable":
        return "The service is temporarily unavailable. Try again in a minute.";
      case "not_found":
        return e.message || "This wasn't found.";
      default:
        return e.message || fallback;
    }
  }
  return fallback;
}

type Query = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  /** Skip the Authorization header (public routes such as invite preview). */
  anonymous?: boolean;
};

/** Hooks the app shell installs so the client can react to auth state without importing router code. */
type AuthHandlers = {
  onUnauthenticated: () => void;
  onMfaRequired: (to: "/login/mfa" | "/setup-mfa") => void;
};
let handlers: AuthHandlers | null = null;
export function setAuthHandlers(next: AuthHandlers | null) {
  handlers = next;
}

let redirecting = false;

function buildUrl(path: string, query?: Query) {
  const url = new URL(`${env.apiUrl}${path.startsWith("/") ? path : `/${path}`}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url;
}

async function accessToken(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function parseError(res: Response): Promise<ApiRequestError> {
  let code: ApiRequestError["code"] = "unknown";
  let message = res.statusText || "Request failed";
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>;
    if (body?.error?.code) code = body.error.code as KnownErrorCode;
    if (body?.error?.message) message = body.error.message;
  } catch {
    // Non-JSON error body: keep the status text.
  }
  if (code === "unknown") {
    if (res.status === 401) code = "unauthenticated";
    else if (res.status === 403) code = "forbidden";
    else if (res.status === 404) code = "not_found";
    else if (res.status === 409) code = "conflict";
    else if (res.status === 422) code = "validation";
    else if (res.status === 429) code = "rate_limited";
    else if (res.status === 503) code = "unavailable";
    else if (res.status >= 500) code = "internal";
  }
  return new ApiRequestError(res.status, code, message);
}

/**
 * Fetch wrapper for the Rust API. Attaches the Supabase access token, parses ApiError
 * bodies into ApiRequestError, signs out on 401 and routes to MFA on 403 mfa_required.
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!isApiConfigured) {
    throw new ApiRequestError(0, "not_configured", "NEXT_PUBLIC_API_URL is not set.");
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (!opts.anonymous) {
    const token = await accessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
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

  if (!res.ok) {
    const err = await parseError(res);
    if (!opts.anonymous) await handleAuthError(err);
    throw err;
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return (await res.json()) as T;
}

async function handleAuthError(err: ApiRequestError) {
  if (redirecting || !handlers) return;
  if (err.status === 401 || err.code === "unauthenticated" || err.code === "account_disabled") {
    redirecting = true;
    try {
      await getSupabase().auth.signOut();
    } catch {
      // Already signed out locally.
    }
    handlers.onUnauthenticated();
    redirecting = false;
  } else if (err.code === "mfa_required") {
    redirecting = true;
    try {
      handlers.onMfaRequired(await mfaDestination());
    } finally {
      redirecting = false;
    }
  }
}

"use client";

import { useSyncExternalStore } from "react";
import { ApiRequestError, isApiError, parseError } from "@/lib/api/errors";
import type { Aal, ResendResult } from "@/lib/api/types";
import { CSRF_HEADER, type SessionBody, type SignInReason, type TwoFactorChallenge } from "./types";

/*
 * Browser half of auth. The access token (15 minutes) lives in this module's memory only. The
 * long-lived refresh token is an httpOnly cookie the /api/auth/* route handlers manage, so no
 * script here can read it. `getAccessToken()` trades the cookie for a fresh access token when
 * the one in memory is missing or about to expire, one request at a time.
 */

export type SessionStatus = "unknown" | "signedIn" | "signedOut";
export type SessionState = { status: SessionStatus; aal: Aal | null };

let token: string | null = null;
let expiresAt = 0;
let snapshot: SessionState = { status: "unknown", aal: null };
const listeners = new Set<() => void>();

function setState(next: SessionState) {
  if (next.status === snapshot.status && next.aal === snapshot.aal) return;
  snapshot = next;
  listeners.forEach((l) => l());
}

function applySession(body: SessionBody) {
  token = body.access_token;
  expiresAt = Date.now() + body.expires_in * 1000;
  setState({ status: "signedIn", aal: body.aal });
}

function clearLocal() {
  token = null;
  expiresAt = 0;
  setState({ status: "signedOut", aal: null });
}

export function subscribeSession(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
export const getSessionState = () => snapshot;
const serverState: SessionState = { status: "unknown", aal: null };

/** Auth state for components: "unknown" until the first refresh answers, then signedIn or signedOut. */
export function useSession(): SessionState {
  return useSyncExternalStore(subscribeSession, getSessionState, () => serverState);
}

/* ---------- talking to the route handlers ---------- */

async function bff<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", [CSRF_HEADER]: "1" },
      body: JSON.stringify(body ?? {}),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiRequestError(0, "network", "Network request failed");
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/* ---------- access token ---------- */

export type RefreshResult = "ok" | "expired" | "unavailable";
let inflight: Promise<RefreshResult> | null = null;

/** Trade the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<RefreshResult> {
  inflight ??= (async (): Promise<RefreshResult> => {
    try {
      applySession(await bff<SessionBody>("session"));
      return "ok";
    } catch (e) {
      if (isApiError(e) && e.status === 401) {
        clearLocal();
        return "expired";
      }
      return "unavailable";
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export type TokenOptions = {
  /** Always refresh (the server rejected the token). */
  force?: boolean;
  /** Refresh unless the token stays valid this long. Default 60. */
  minValiditySec?: number;
};

/** A valid access token, refreshing first when needed. Null when signed out. */
export async function getAccessToken(opts: TokenOptions = {}): Promise<string | null> {
  const margin = (opts.minValiditySec ?? 60) * 1000;
  if (!opts.force && token && expiresAt - Date.now() > margin) return token;
  if (!opts.force && snapshot.status === "signedOut") return null;
  const result = await refreshSession();
  if (result === "ok") return token;
  // Auth service unreachable: keep using the current token until it really expires.
  if (result === "unavailable" && token && expiresAt > Date.now()) return token;
  return null;
}

/**
 * After a 401 `unauthenticated` for a request sent with `used`: refresh once (unless another
 * caller already did) and say whether the request can be retried.
 */
export async function recoverFromUnauthenticated(used: string | null): Promise<RefreshResult> {
  if (token && used !== token && expiresAt > Date.now()) return "ok";
  return refreshSession();
}

/* ---------- sign in ---------- */

export type SignInResult =
  | { kind: "signed_in"; aal: Aal }
  | { kind: "two_factor"; challenge: TwoFactorChallenge };

type LoginBody =
  | (SessionBody & { status: "signed_in" })
  | ({ status: "two_factor_required" } & TwoFactorChallenge);

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const body = await bff<LoginBody>("login", { email, password });
  if (body.status === "two_factor_required") {
    const { challenge_id, email_hint, expires_in, resend_after } = body;
    return { kind: "two_factor", challenge: { challenge_id, email_hint, expires_in, resend_after } };
  }
  applySession(body);
  return { kind: "signed_in", aal: body.aal };
}

export async function verifyCode(challengeId: string, code: string): Promise<void> {
  applySession(await bff<SessionBody>("two-factor/verify", { challenge_id: challengeId, code }));
}

export function resendCode(challengeId: string): Promise<ResendResult> {
  return bff<ResendResult>("two-factor/resend", { challenge_id: challengeId });
}

/* ---------- sign out ---------- */

type Task = () => void | Promise<void>;
const beforeTasks = new Set<Task>();
const afterTasks = new Set<Task>();

/** Runs while the session can still authorise requests (remove this browser's push token). */
export function onBeforeSignOut(fn: Task) {
  beforeTasks.add(fn);
  return () => void beforeTasks.delete(fn);
}
/** Runs once the session is gone locally (clear the query cache). */
export function onSignedOut(fn: Task) {
  afterTasks.add(fn);
  return () => void afterTasks.delete(fn);
}

const AUTH_PATHS = ["/login", "/forgot-password", "/reset-password", "/invite/"];

export function redirectToLogin(reason?: SignInReason): boolean {
  if (typeof window === "undefined") return false;
  const { pathname, search } = window.location;
  if (AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`))) return false;
  const params = new URLSearchParams();
  if (reason) params.set("reason", reason);
  if (pathname !== "/") params.set("next", pathname + search);
  const qs = params.toString();
  // A full navigation also drops every in-memory cache, which is what we want after sign-out.
  window.location.assign(qs ? `/login?${qs}` : "/login");
  return true;
}

async function runTasks(tasks: Set<Task>) {
  for (const t of [...tasks]) {
    try {
      await t();
    } catch {
      // A failing cleanup must never block sign-out.
    }
  }
}

let channel: BroadcastChannel | null = null;
function getChannel() {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel("ahead-one.auth");
    channel.onmessage = (e: MessageEvent) => {
      if (e.data !== "signed-out") return;
      // Another tab signed out: follow it. The cookie is already cleared.
      clearLocal();
      void runTasks(afterTasks).then(() => redirectToLogin());
    };
  }
  return channel;
}
// Listen from the first import so a tab that never signs out itself still follows the others.
getChannel();

let signingOut: Promise<void> | null = null;

/**
 * End this session everywhere it matters: remove the push token, revoke the refresh token and
 * clear the cookie, wipe local state and caches, tell the other tabs, and go to the sign-in page.
 */
export function signOut(opts: { reason?: SignInReason; redirect?: boolean } = {}): Promise<void> {
  signingOut ??= (async () => {
    try {
      if (opts.reason !== "expired") {
        await Promise.race([runTasks(beforeTasks), new Promise((r) => setTimeout(r, 3000))]);
      }
      try {
        await bff("logout");
      } catch {
        // Offline or the API is down: the cookie clears on the next successful call. Signed out locally either way.
      }
    } finally {
      clearLocal();
      await runTasks(afterTasks);
      getChannel()?.postMessage("signed-out");
      // Once the page is navigating away, stay "signing out" so nothing starts a second round.
      const leaving = opts.redirect !== false && redirectToLogin(opts.reason);
      if (!leaving) signingOut = null;
    }
  })();
  return signingOut;
}

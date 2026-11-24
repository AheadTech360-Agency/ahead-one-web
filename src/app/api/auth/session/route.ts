import type { NextRequest } from "next/server";
import { REFRESH_COOKIE } from "@/lib/auth/cookie";
import {
  callApi,
  clearRefreshCookie,
  csrfGuard,
  errorResponse,
  isSessionTokens,
  relayError,
  sessionResponse,
  upstreamInvalid,
} from "@/lib/auth/server";

/**
 * POST: trade the refresh cookie for a fresh access token. The API rotates the refresh token on
 * every use, so the cookie is replaced. When it answers `refresh_token: null` (another tab just
 * rotated it) the cookie is left alone. A 401 means the session is over, so the cookie is cleared.
 */
export async function POST(req: NextRequest) {
  const blocked = csrfGuard(req);
  if (blocked) return blocked;
  const token = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!token) return errorResponse(401, "unauthenticated", "You're signed out. Sign in to continue.");

  const up = await callApi(req, "/v1/auth/refresh", { refresh_token: token });
  if (up.status === 401) {
    const res = relayError(up);
    clearRefreshCookie(res);
    return res;
  }
  if (up.status !== 200) return relayError(up);
  if (!isSessionTokens(up.body)) return upstreamInvalid();
  return sessionResponse(up.body);
}

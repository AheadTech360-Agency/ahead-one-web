import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE } from "@/lib/auth/cookie";
import { callApi, clearRefreshCookie, csrfGuard } from "@/lib/auth/server";

/** Revoke the session at the API (best effort) and always clear the cookie. */
export async function POST(req: NextRequest) {
  const blocked = csrfGuard(req);
  if (blocked) return blocked;
  const token = req.cookies.get(REFRESH_COOKIE)?.value;
  if (token) await callApi(req, "/v1/auth/logout", { refresh_token: token });
  const res = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  clearRefreshCookie(res);
  return res;
}

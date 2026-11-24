import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE } from "@/lib/auth/cookie";

/*
 * Route guard. A cheap, optimistic check on the presence of the refresh cookie: no cookie sends
 * the visitor to /login, a cookie keeps them out of the sign-in pages. It does not verify
 * anything. The Rust API is the authority on every request, and the client follows its answers
 * (a stale cookie is cleared by /api/auth/session or /api/auth/logout).
 */

const PUBLIC_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/invite/"];
const SIGNED_OUT_ONLY = ["/login", "/forgot-password"];

function isPublic(pathname: string) {
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/dev/")) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`));
}

export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(REFRESH_COOKIE)?.value);
  const { pathname, search } = request.nextUrl;

  if (!hasSession && !isPublic(pathname)) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(to);
  }

  // A `reason` means the client just ended the session; never bounce those visits back into the app.
  if (hasSession && SIGNED_OUT_ONLY.includes(pathname) && !request.nextUrl.searchParams.has("reason")) {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    to.search = "";
    return NextResponse.redirect(to);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/auth/|favicon.ico|icon.svg|robots.txt|firebase-messaging-sw.js|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

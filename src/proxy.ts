import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/*
 * Route guard. Refreshes the Supabase session cookie and sends signed-out visitors to /login.
 * This is an optimistic check for navigation only: the Rust API verifies every token and
 * enforces roles and MFA (403 mfa_required), and the client follows those answers.
 */

const PUBLIC_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/invite/"];
const SIGNED_OUT_ONLY = ["/login", "/forgot-password"];

function isPublic(pathname: string) {
  if (pathname === "/login/mfa") return false;
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/dev/")) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`));
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });

  // Without configuration there is no session to check; the client shows a config notice.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!signedIn && !isPublic(pathname)) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return redirectWithCookies(to, response);
  }

  if (signedIn && SIGNED_OUT_ONLY.includes(pathname)) {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    to.search = "";
    return redirectWithCookies(to, response);
  }

  return response;
}

function redirectWithCookies(to: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(to);
  from.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|firebase-messaging-sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

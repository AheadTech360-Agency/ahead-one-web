"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { setAuthHandlers } from "@/lib/api/client";
import { isSupabaseConfigured } from "@/lib/env";
import { getSupabase, mfaDestination } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace";

/**
 * Client half of the route guard (the proxy does the signed-out redirect).
 * - Installs the API client's 401 / mfa_required handlers.
 * - Sends a session that has a verified TOTP factor but is still aal1 to /login/mfa.
 * - Sends owners/admins without MFA (/v1/me mfa_required) to /setup-mfa.
 * - Follows sign-out from another tab.
 */
export function AuthGate() {
  const router = useRouter();
  const pathname = usePathname();
  const { me } = useWorkspace();

  useEffect(() => {
    setAuthHandlers({
      onUnauthenticated: () => router.replace(`/login?next=${encodeURIComponent(pathname)}`),
      onMfaRequired: (to) => router.replace(`${to}?next=${encodeURIComponent(pathname)}`),
    });
    return () => setAuthHandlers(null);
  }, [router, pathname]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    let cancelled = false;
    void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (!cancelled && data?.currentLevel === "aal1" && data.nextLevel === "aal2") {
        router.replace(`/login/mfa?next=${encodeURIComponent(pathname)}`);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // Checked once per mount of the shell, not on every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const mfaRequired = me?.mfa_required;
  useEffect(() => {
    if (!mfaRequired) return;
    void mfaDestination().then((to) => router.replace(`${to}?next=${encodeURIComponent(pathname)}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mfaRequired, router]);

  return null;
}

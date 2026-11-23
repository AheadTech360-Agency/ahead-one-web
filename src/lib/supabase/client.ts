"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

let client: SupabaseClient | null = null;

/**
 * Browser Supabase client (anon key only). Session lives in cookies so the proxy can
 * guard routes. Call from effects and event handlers, never during render on the server.
 */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  if (!client) {
    client = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  }
  return client;
}

/** Where a signed-in user on aal1 should go to reach aal2. */
export async function mfaDestination(): Promise<"/login/mfa" | "/setup-mfa"> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.nextLevel === "aal2" ? "/login/mfa" : "/setup-mfa";
}


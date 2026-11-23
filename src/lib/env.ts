/*
 * Public runtime configuration. Only NEXT_PUBLIC_* values belong here: they are inlined
 * into the browser bundle. Never add a Supabase service role key or any other secret.
 * Each variable is referenced literally so Next.js can inline it.
 */

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, ""),
} as const;

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const isApiConfigured = Boolean(env.apiUrl);

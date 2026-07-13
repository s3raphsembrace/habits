import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Single browser-side Supabase client (anon key — safe to expose; all data
 * access is gated by Row Level Security policies in supabase/schema.sql).
 * Placeholder fallbacks let `next build` succeed before env vars exist.
 */
let client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key"
    );
  }
  return client;
}

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

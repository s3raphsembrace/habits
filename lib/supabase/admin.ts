import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. ONLY for the Stripe webhook, which has
 * no user session and must write the billing table that users can't touch.
 * SUPABASE_SERVICE_ROLE_KEY is server-only; never expose it with NEXT_PUBLIC_.
 */
export function supabaseAdmin(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    key,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

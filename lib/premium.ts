import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Premium check for route handlers. Reads the RLS-protected billing row —
 * users can read their own status but only the Stripe webhook (service role)
 * can write it, so this cannot be spoofed from the client.
 */
export async function isPremium(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase
    .from("billing_customers")
    .select("is_premium, current_period_end")
    .maybeSingle();
  if (!data?.is_premium) return false;
  // A canceled-but-paid-up subscription stays premium until the period ends.
  if (data.current_period_end && new Date(data.current_period_end) < new Date()) return false;
  return true;
}

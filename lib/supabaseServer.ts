import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import type { NextApiRequest } from "next";

/**
 * Server-side Supabase access for API routes.
 *
 * Security model: the browser sends the user's access token as
 * `Authorization: Bearer <jwt>`. We build a per-request client that forwards
 * that token, so Postgres Row Level Security evaluates every query AS THE
 * USER. Even if a handler forgets a `where user_id = ...` filter, RLS
 * prevents reading or writing anyone else's rows. Authorization lives in the
 * database, not in the UI.
 */
export function supabaseForRequest(req: NextApiRequest): SupabaseClient {
  const authHeader = req.headers.authorization ?? "";
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

/** Verifies the bearer token and returns the authenticated user, or null. */
export async function getUserFromRequest(req: NextApiRequest): Promise<User | null> {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabase = supabaseForRequest(req);
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data.user;
}

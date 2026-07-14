import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

/**
 * Cookie-authenticated client for server components and route handlers.
 * Postgres Row Level Security evaluates every query AS THE USER whose
 * session is in the cookies — authorization lives in the database.
 */
export async function supabaseServer(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(URL, KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component render — safe to ignore because
          // middleware refreshes sessions before we get here.
        }
      },
    },
  });
}

/**
 * Auth context for REST route handlers. Browsers authenticate via cookies;
 * non-browser clients (the planned mobile app) may instead send
 * `Authorization: Bearer <jwt>` — both paths end at the same RLS policies.
 */
export async function routeContext(
  req: NextRequest
): Promise<{ supabase: SupabaseClient; user: User | null }> {
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "");

  if (bearer) {
    const supabase = createClient(URL, KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getUser(bearer);
    return { supabase, user: error ? null : data.user };
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : data.user };
}

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ImportSession {
  sleep_start: string;
  sleep_end: string;
}

/** Two sessions are "the same night" if their starts are within 10 minutes. */
const DEDUPE_MS = 10 * 60_000;

/**
 * Inserts sleep sessions, skipping near-duplicates of existing logs (and of
 * each other), so re-running any import/sync is idempotent. Shared by the
 * file-import endpoint and the Oura sync. RLS scopes the existing-log lookup
 * to the authenticated user.
 */
export async function insertSessionsDeduped(
  supabase: SupabaseClient,
  userId: string,
  sessions: ImportSession[]
): Promise<{ imported: number; skipped: number }> {
  if (sessions.length === 0) return { imported: 0, skipped: 0 };

  const starts = sessions.map((s) => new Date(s.sleep_start).getTime());
  const rangeMin = new Date(Math.min(...starts) - DEDUPE_MS).toISOString();
  const rangeMax = new Date(Math.max(...starts) + DEDUPE_MS).toISOString();

  const { data: existing, error: fetchError } = await supabase
    .from("sleep_logs")
    .select("sleep_start")
    .gte("sleep_start", rangeMin)
    .lte("sleep_start", rangeMax)
    .limit(2000);
  if (fetchError) throw new Error(fetchError.message);

  const known = (existing ?? []).map((r) => new Date(r.sleep_start).getTime());
  const fresh: ImportSession[] = [];
  let skipped = 0;

  for (const session of sessions) {
    const t = new Date(session.sleep_start).getTime();
    const isDupe =
      known.some((k) => Math.abs(k - t) <= DEDUPE_MS) ||
      fresh.some((f) => Math.abs(new Date(f.sleep_start).getTime() - t) <= DEDUPE_MS);
    if (isDupe) skipped++;
    else fresh.push(session);
  }

  if (fresh.length > 0) {
    const { error } = await supabase
      .from("sleep_logs")
      .insert(fresh.map((s) => ({ ...s, user_id: userId })));
    if (error) throw new Error(error.message);
  }

  return { imported: fresh.length, skipped };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeInsights, DEFAULT_SLEEP_NEED_HOURS, type SleepLog } from "./sleepDebt";
import { buildRecommendations, type Recommendation } from "./recommendations";
import { computeSleepScore, type SleepScore } from "./sleepScore";
import type { SleepInsights } from "./sleepDebt";

export interface SleepContext {
  insights: SleepInsights;
  recommendations: Recommendation[];
  score: SleepScore;
  needHours: number;
}

/**
 * Loads the signed-in user's logs + profile (RLS-scoped by the client passed
 * in) and computes everything derived from them. Shared by /api/insights and
 * /api/coach so both always agree on the numbers.
 */
export async function fetchSleepContext(supabase: SupabaseClient): Promise<SleepContext> {
  const [logsResult, profileResult] = await Promise.all([
    supabase
      .from("sleep_logs")
      .select("sleep_start, sleep_end, energy_rating")
      .order("sleep_end", { ascending: false })
      .limit(60),
    supabase.from("profiles").select("sleep_need_hours").maybeSingle(),
  ]);

  if (logsResult.error) throw new Error(logsResult.error.message);

  const needHours = Number(profileResult.data?.sleep_need_hours ?? DEFAULT_SLEEP_NEED_HOURS);
  const logs = logsResult.data as SleepLog[];
  const insights = computeInsights(logs, needHours);

  return {
    insights,
    recommendations: buildRecommendations(insights),
    score: computeSleepScore(logs, needHours),
    needHours,
  };
}

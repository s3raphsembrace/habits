import { NextResponse, type NextRequest } from "next/server";
import { routeContext } from "@/lib/supabase/server";
import { computeInsights, DEFAULT_SLEEP_NEED_HOURS, type SleepLog } from "@/lib/sleepDebt";
import { buildRecommendations } from "@/lib/recommendations";

/**
 * GET /api/insights -> sleep debt, averages, melatonin window, and
 * recommendations for the authenticated user. All computation happens
 * server-side from the raw logs so the client stays thin.
 */
export async function GET(req: NextRequest) {
  const { supabase, user } = await routeContext(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const [logsResult, profileResult] = await Promise.all([
    supabase
      .from("sleep_logs")
      .select("sleep_start, sleep_end, energy_rating")
      .order("sleep_end", { ascending: false })
      .limit(60),
    supabase.from("profiles").select("sleep_need_hours").maybeSingle(),
  ]);

  if (logsResult.error) {
    return NextResponse.json({ error: logsResult.error.message }, { status: 500 });
  }

  const needHours = profileResult.data?.sleep_need_hours ?? DEFAULT_SLEEP_NEED_HOURS;
  const insights = computeInsights(logsResult.data as SleepLog[], Number(needHours));

  return NextResponse.json({
    insights,
    recommendations: buildRecommendations(insights),
    sleepNeedHours: Number(needHours),
  });
}

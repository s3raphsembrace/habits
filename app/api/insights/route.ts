import { NextResponse, type NextRequest } from "next/server";
import { routeContext } from "@/lib/supabase/server";
import { fetchSleepContext } from "@/lib/sleepContext";

/**
 * GET /api/insights -> sleep debt, averages, melatonin window, sleep score,
 * and recommendations for the authenticated user. All computation happens
 * server-side from the raw logs so the client stays thin.
 */
export async function GET(req: NextRequest) {
  const { supabase, user } = await routeContext(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const { insights, recommendations, score, needHours } = await fetchSleepContext(supabase);
    return NextResponse.json({
      insights,
      recommendations,
      sleepScore: score,
      sleepNeedHours: needHours,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load insights" },
      { status: 500 }
    );
  }
}

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserFromRequest, supabaseForRequest } from "@/lib/supabaseServer";
import { computeInsights, DEFAULT_SLEEP_NEED_HOURS, SleepLog } from "@/lib/sleepDebt";
import { buildRecommendations } from "@/lib/recommendations";

/**
 * GET /api/insights -> sleep debt, averages, melatonin window, and
 * recommendations for the authenticated user. All computation happens
 * server-side from the raw logs so the client stays thin.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Not signed in" });

  const supabase = supabaseForRequest(req);

  const [logsResult, profileResult] = await Promise.all([
    supabase
      .from("sleep_logs")
      .select("sleep_start, sleep_end, energy_rating")
      .order("sleep_end", { ascending: false })
      .limit(60),
    supabase.from("profiles").select("sleep_need_hours").maybeSingle(),
  ]);

  if (logsResult.error) return res.status(500).json({ error: logsResult.error.message });

  const needHours = profileResult.data?.sleep_need_hours ?? DEFAULT_SLEEP_NEED_HOURS;
  const insights = computeInsights(logsResult.data as SleepLog[], Number(needHours));

  return res.status(200).json({
    insights,
    recommendations: buildRecommendations(insights),
    sleepNeedHours: Number(needHours),
  });
}

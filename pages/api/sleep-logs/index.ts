import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getUserFromRequest, supabaseForRequest } from "@/lib/supabaseServer";

const createLogSchema = z
  .object({
    sleep_start: z.string().datetime({ offset: true }),
    sleep_end: z.string().datetime({ offset: true }),
    energy_rating: z.number().int().min(1).max(5).nullable().optional(),
    note: z.string().max(500).optional(),
  })
  .refine((d) => new Date(d.sleep_end) > new Date(d.sleep_start), {
    message: "sleep_end must be after sleep_start",
  })
  .refine(
    (d) => new Date(d.sleep_end).getTime() - new Date(d.sleep_start).getTime() <= 24 * 3_600_000,
    { message: "A single sleep session cannot exceed 24 hours" }
  );

/**
 * GET  /api/sleep-logs  -> last 30 logs for the authenticated user
 * POST /api/sleep-logs  -> create a log
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Not signed in" });

  const supabase = supabaseForRequest(req);

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("sleep_logs")
      .select("id, sleep_start, sleep_end, energy_rating, note")
      .order("sleep_end", { ascending: false })
      .limit(30);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ logs: data });
  }

  if (req.method === "POST") {
    const parsed = createLogSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const { data, error } = await supabase
      .from("sleep_logs")
      .insert({ ...parsed.data, user_id: user.id })
      .select("id")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ id: data.id });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}

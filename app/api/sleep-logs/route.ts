import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { routeContext } from "@/lib/supabase/server";
import { getPostHogClient } from "@/lib/posthog-server";

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

/** GET /api/sleep-logs -> last 30 logs for the authenticated user */
export async function GET(req: NextRequest) {
  const { supabase, user } = await routeContext(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data, error } = await supabase
    .from("sleep_logs")
    .select("id, sleep_start, sleep_end, energy_rating, note")
    .order("sleep_end", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data });
}

/** POST /api/sleep-logs -> create a log */
export async function POST(req: NextRequest) {
  const { supabase, user } = await routeContext(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("sleep_logs")
    .insert({ ...parsed.data, user_id: user.id })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sleepMs =
    new Date(parsed.data.sleep_end).getTime() - new Date(parsed.data.sleep_start).getTime();
  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: user.id,
    event: "sleep_log_created",
    properties: {
      duration_hours: Math.round((sleepMs / 3_600_000) * 10) / 10,
      has_energy_rating: parsed.data.energy_rating != null,
      has_note: Boolean(parsed.data.note),
    },
  });
  await posthog.flush();

  return NextResponse.json({ id: data.id }, { status: 201 });
}

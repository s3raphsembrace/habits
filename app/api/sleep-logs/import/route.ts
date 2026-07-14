import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { routeContext } from "@/lib/supabase/server";
import { getPostHogClient } from "@/lib/posthog-server";

const sessionSchema = z
  .object({
    sleep_start: z.string().datetime({ offset: true }),
    sleep_end: z.string().datetime({ offset: true }),
  })
  .refine((d) => new Date(d.sleep_end) > new Date(d.sleep_start), {
    message: "sleep_end must be after sleep_start",
  })
  .refine(
    (d) => new Date(d.sleep_end).getTime() - new Date(d.sleep_start).getTime() <= 24 * 3_600_000,
    { message: "A single sleep session cannot exceed 24 hours" }
  );

const importSchema = z.object({
  sessions: z.array(sessionSchema).min(1).max(500),
});

/** Two sessions are "the same night" if their starts are within 10 minutes. */
const DEDUPE_MS = 10 * 60_000;

/**
 * POST /api/sleep-logs/import — bulk ingest from Apple Health / Fitbit / Oura
 * file exports (parsed client-side) or a future mobile companion app.
 * Re-importing the same file is safe: near-duplicate sessions are skipped.
 */
export async function POST(req: NextRequest) {
  const { supabase, user } = await routeContext(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const incoming = parsed.data.sessions;
  const starts = incoming.map((s) => new Date(s.sleep_start).getTime());
  const rangeMin = new Date(Math.min(...starts) - DEDUPE_MS).toISOString();
  const rangeMax = new Date(Math.max(...starts) + DEDUPE_MS).toISOString();

  const { data: existing, error: fetchError } = await supabase
    .from("sleep_logs")
    .select("sleep_start")
    .gte("sleep_start", rangeMin)
    .lte("sleep_start", rangeMax)
    .limit(2000);
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const known = (existing ?? []).map((r) => new Date(r.sleep_start).getTime());
  const fresh: typeof incoming = [];
  let skipped = 0;

  for (const session of incoming) {
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
      .insert(fresh.map((s) => ({ ...s, user_id: user.id })));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: user.id,
    event: "sleep_logs_imported",
    properties: {
      imported: fresh.length,
      skipped,
      total_submitted: incoming.length,
    },
  });
  await posthog.flush();

  return NextResponse.json({ imported: fresh.length, skipped }, { status: 201 });
}

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { routeContext } from "@/lib/supabase/server";
import { insertSessionsDeduped } from "@/lib/sessionsImport";

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

/**
 * POST /api/sleep-logs/import — bulk ingest from Apple Health / Fitbit / Oura
 * file exports (parsed client-side) or the mobile companion app.
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

  try {
    const result = await insertSessionsDeduped(supabase, user.id, parsed.data.sessions);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 }
    );
  }
}

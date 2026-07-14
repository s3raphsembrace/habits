import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { routeContext } from "@/lib/supabase/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const noteSchema = z.object({
  date: z.string().regex(DATE_RE, "date must be YYYY-MM-DD"),
  activities: z.string().max(2000).default(""),
  meals: z.string().max(2000).default(""),
  goals: z.string().max(2000).default(""),
  notes: z.string().max(2000).default(""),
});

const EMPTY = { activities: "", meals: "", goals: "", notes: "" };

/** GET /api/notes?date=YYYY-MM-DD -> that day's journal entry (empty defaults if none) */
export async function GET(req: NextRequest) {
  const { supabase, user } = await routeContext(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("daily_notes")
    .select("activities, meals, goals, notes, updated_at")
    .eq("note_date", date)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ note: data ?? EMPTY });
}

/** PUT /api/notes -> upsert the journal entry for a day */
export async function PUT(req: NextRequest) {
  const { supabase, user } = await routeContext(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { date, ...fields } = parsed.data;
  const { error } = await supabase.from("daily_notes").upsert(
    {
      user_id: user.id,
      note_date: date,
      ...fields,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,note_date" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

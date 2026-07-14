import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { routeContext } from "@/lib/supabase/server";
import { isPremium } from "@/lib/premium";
import { insertSessionsDeduped, type ImportSession } from "@/lib/sessionsImport";

const bodySchema = z.object({
  // New token to save, or omit to sync with the previously saved one.
  token: z.string().trim().max(300).optional(),
});

const OURA_API = "https://api.ouraring.com/v2/usercollection/sleep";

/**
 * POST /api/integrations/oura — Premium. Saves an Oura personal access token
 * (if provided) and syncs the last 30 days of sleep from the Oura API.
 * Get a token at cloud.ouraring.com/personal-access-tokens.
 */
export async function POST(req: NextRequest) {
  const { supabase, user } = await routeContext(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!(await isPremium(supabase))) {
    return NextResponse.json(
      { error: "Oura sync is a Premium feature.", premiumRequired: true },
      { status: 403 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  let token = parsed.data.token;
  if (token) {
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: user.id, oura_token: token }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { data } = await supabase.from("profiles").select("oura_token").maybeSingle();
    token = data?.oura_token ?? undefined;
  }
  if (!token) {
    return NextResponse.json({ error: "No Oura token saved yet." }, { status: 400 });
  }

  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 3_600_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const ouraRes = await fetch(
    `${OURA_API}?start_date=${fmt(start)}&end_date=${fmt(end)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).catch(() => null);

  if (!ouraRes || ouraRes.status === 401) {
    return NextResponse.json(
      { error: "Oura rejected the token — check it at cloud.ouraring.com and save it again." },
      { status: 502 }
    );
  }
  if (!ouraRes.ok) {
    return NextResponse.json({ error: `Oura API error (${ouraRes.status}).` }, { status: 502 });
  }

  const payload = await ouraRes.json();
  const sessions: ImportSession[] = (payload.data ?? [])
    .filter((r: any) => r.bedtime_start && r.bedtime_end)
    .map((r: any) => ({ sleep_start: r.bedtime_start, sleep_end: r.bedtime_end }))
    .filter((s: ImportSession) => {
      const dur = new Date(s.sleep_end).getTime() - new Date(s.sleep_start).getTime();
      return dur >= 10 * 60_000 && dur <= 24 * 3_600_000;
    });

  try {
    const result = await insertSessionsDeduped(supabase, user.id, sessions);
    return NextResponse.json({ ...result, fetched: sessions.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}

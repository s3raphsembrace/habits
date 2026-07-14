import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { routeContext } from "@/lib/supabase/server";
import { fetchSleepContext } from "@/lib/sleepContext";

const coachSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(1000),
      })
    )
    .min(1)
    .max(12),
});

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * POST /api/coach — AI sleep coach grounded in the user's own numbers.
 * Uses the Gemini API when GEMINI_API_KEY is set (free tier via Google AI
 * Studio); otherwise answers from the rule-based recommendation engine so
 * the feature still works without a key.
 */
export async function POST(req: NextRequest) {
  const { supabase, user } = await routeContext(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = coachSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  let context;
  try {
    context = await fetchSleepContext(supabase);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load your data" },
      { status: 500 }
    );
  }
  const { insights, recommendations, score, needHours } = context;

  // Today's journal makes the advice concrete (late caffeine, workouts, goals).
  const today = new Date().toISOString().slice(0, 10);
  const { data: journal } = await supabase
    .from("daily_notes")
    .select("activities, meals, goals, notes")
    .eq("note_date", today)
    .maybeSingle();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const reply = [
      "The AI coach isn't connected yet (no GEMINI_API_KEY configured), so here is what the rule engine says about your data:",
      ...recommendations.map((r) => `• ${r.title} — ${r.body}`),
    ].join("\n\n");
    return NextResponse.json({ reply, offline: true });
  }

  const dataSummary = [
    `Sleep need: ${needHours}h/night`,
    `Sleep debt (14d): ${insights.sleepDebtHours}h`,
    `Average sleep: ${insights.avgSleepHours ?? "unknown"}h`,
    `Average self-rated energy: ${insights.avgEnergy ?? "not rated"}/5`,
    `Habitual bedtime: ${insights.medianBedtime ?? "unknown"}, wake: ${insights.medianWake ?? "unknown"}`,
    `Melatonin window: ${insights.melatoninWindow ? `${insights.melatoninWindow.start}–${insights.melatoninWindow.end}` : "unknown"}`,
    `Sleep score: ${score.score ?? "n/a"}/100 (${score.label ?? "no data"})`,
    `Nights logged in window: ${insights.nightsLogged}`,
    journal
      ? `Today's journal — activities: ${journal.activities || "-"}; meals: ${journal.meals || "-"}; goals: ${journal.goals || "-"}; notes: ${journal.notes || "-"}`
      : "No journal entry today.",
    `Rule-engine suggestions: ${recommendations.map((r) => r.title).join("; ")}`,
  ].join("\n");

  const system = `You are the sleep coach for "Habits: Sleep Quality". Ground every answer in the user's data below — cite their actual numbers. Be practical and specific (times, durations), under 180 words, warm but not fluffy. You give educational lifestyle guidance only, never diagnoses; if they describe symptoms of a sleep disorder (apnea, chronic insomnia), advise seeing a doctor. Plain text only, no markdown headers.

User data:
${dataSummary}`;

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const geminiRes = await fetch(`${GEMINI_URL}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: parsed.data.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: 600, temperature: 0.6 },
    }),
  }).catch(() => null);

  if (!geminiRes || !geminiRes.ok) {
    return NextResponse.json(
      { error: "The coach is unavailable right now — try again in a minute." },
      { status: 502 }
    );
  }

  const result = await geminiRes.json();
  const reply: string =
    result.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim() ?? "";

  if (!reply) {
    return NextResponse.json(
      { error: "The coach didn't answer — try rephrasing." },
      { status: 502 }
    );
  }

  return NextResponse.json({ reply });
}

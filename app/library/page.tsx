import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sleep library" };

/**
 * Static knowledge library, rendered entirely on the server (zero JS shipped
 * for this page's content). If it grows, move articles to MDX files or a
 * Supabase table.
 */
const ARTICLES = [
  {
    title: "What sleep debt actually is",
    body: "Sleep debt is the running difference between the sleep your body needs and the sleep it gets, accumulated over roughly two weeks. Small nightly shortfalls compound: six nights of 7h sleep against an 8h need is a full night of sleep owed. Debt above ~5 hours measurably reduces reaction time, mood, and glucose regulation.",
  },
  {
    title: "Your melatonin window",
    body: "Melatonin — the hormone that opens the 'sleep gate' — starts rising about two hours before your habitual bedtime. Falling asleep inside that window is dramatically easier than before it (when your circadian alerting signal is still high) or long after it (when you get a 'second wind'). Bright screens during the window suppress melatonin and push it later.",
  },
  {
    title: "Naps: the good, the bad, the timing",
    body: "A 10–20 minute nap before about 3pm pays down sleep debt with almost no downside. Longer naps risk sleep inertia (grogginess from waking in deep sleep), and late naps drain the sleep pressure you need at night. If you're fighting insomnia, skip naps entirely until nights stabilize.",
  },
  {
    title: "Why sleeping in doesn't fix it",
    body: "Recovering debt by sleeping in on weekends shifts your circadian rhythm later — 'social jetlag' — making Monday nights harder. Research suggests it's better to go to bed earlier at your usual wake time. Consistency of wake time is the single strongest anchor for your body clock.",
  },
  {
    title: "Caffeine's 6-hour shadow",
    body: "Caffeine has a half-life of 5–6 hours: a 4pm coffee means half the caffeine is still blocking your adenosine (sleep pressure) receptors at 10pm. If you carry sleep debt, front-load caffeine before noon and let adenosine build naturally in the evening.",
  },
  {
    title: "Sleep and longevity",
    body: "Large cohort studies associate chronic short sleep (under ~6.5h) with higher all-cause mortality, cardiovascular disease, and dementia risk. The mechanisms — impaired glymphatic clearance, elevated cortisol, blood-pressure non-dipping — are dose-dependent, which is exactly why tracking and paying down debt matters.",
  },
];

export default function LibraryPage() {
  return (
    <>
      <h1>Sleep knowledge library</h1>
      <p className="muted">
        Short, actionable summaries of the research behind our recommendations.
      </p>
      <div className="stack">
        {ARTICLES.map((a) => (
          <article key={a.title} className="card">
            <h3>{a.title}</h3>
            <p>{a.body}</p>
          </article>
        ))}
      </div>
    </>
  );
}

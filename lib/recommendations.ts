/**
 * Rule-based recommendation engine. Deterministic on purpose for v1:
 * every tip can be traced to a threshold, which makes the advice auditable.
 * An LLM (e.g. Claude API) can be layered on top later to phrase these
 * conversationally — see README "Roadmap".
 */
import { SleepInsights } from "./sleepDebt";

export interface Recommendation {
  title: string;
  body: string;
  severity: "info" | "warn" | "high";
}

export function buildRecommendations(insights: SleepInsights): Recommendation[] {
  const recs: Recommendation[] = [];
  const { sleepDebtHours, avgSleepHours, avgEnergy, melatoninWindow, nightsLogged } = insights;

  if (nightsLogged < 3) {
    recs.push({
      title: "Log a few more nights",
      body: "With at least 3 nights logged we can estimate your sleep debt and melatonin window reliably. Keep logging!",
      severity: "info",
    });
    return recs;
  }

  if (sleepDebtHours >= 10) {
    recs.push({
      title: "High sleep debt — prioritize recovery",
      body: `You're carrying about ${sleepDebtHours}h of sleep debt. Aim to go to bed 45-60 minutes earlier for the next week rather than sleeping in, which drifts your circadian rhythm.`,
      severity: "high",
    });
  } else if (sleepDebtHours >= 5) {
    recs.push({
      title: "Moderate sleep debt",
      body: `About ${sleepDebtHours}h of sleep debt. A 20-minute nap before 3pm pays this down without hurting tonight's sleep pressure.`,
      severity: "warn",
    });
  } else {
    recs.push({
      title: "Sleep debt under control",
      body: `Only ${sleepDebtHours}h of debt — nice. Consistency is now your biggest lever: keep bed and wake times within a 1-hour band.`,
      severity: "info",
    });
  }

  if (melatoninWindow) {
    recs.push({
      title: "Your melatonin window",
      body: `Your body likely starts releasing melatonin around ${melatoninWindow.start}. Dim screens and lights then, and aim to be in bed between ${melatoninWindow.start} and ${melatoninWindow.end} for the easiest sleep onset.`,
      severity: "info",
    });
  }

  if (avgSleepHours !== null && avgSleepHours < 6.5) {
    recs.push({
      title: "Short average sleep",
      body: `You're averaging ${avgSleepHours}h per night. Chronic short sleep is linked to reduced immunity, mood, and longevity — treat bedtime like a meeting you can't move.`,
      severity: "warn",
    });
  }

  if (avgEnergy !== null && avgEnergy <= 2.5) {
    recs.push({
      title: "Low daytime energy",
      body: `Your self-reported energy averages ${avgEnergy}/5. Beyond duration, check sleep timing: sleeping outside your melatonin window reduces sleep quality even at the same duration.`,
      severity: "warn",
    });
  }

  return recs;
}

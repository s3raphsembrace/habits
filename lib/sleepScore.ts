/**
 * Sleep score (0-100) — a weighted composite of the four things we can
 * actually measure, computed over the same 14-day window as sleep debt.
 * Pure functions; every weight and threshold is visible below.
 *
 *   debt        35%  — 0h debt = full marks, 20h+ = zero
 *   duration    30%  — average sleep vs personal need
 *   consistency 20%  — bedtime spread (std dev): ≤30min = full, ≥3h = zero
 *   energy      15%  — self-reported 1-5 ratings
 *
 * Missing inputs (no energy ratings, <3 nights for consistency) drop out and
 * the remaining weights are renormalized, so the score never punishes you for
 * data you haven't logged.
 */
import {
  computeSleepDebt,
  DEBT_WINDOW_DAYS,
  DEFAULT_SLEEP_NEED_HOURS,
  hoursBetween,
  logsInWindow,
  SleepLog,
} from "./sleepDebt";

export type ScoreLabel = "Good" | "Fair" | "Needs work";

export interface ScorePart {
  key: "debt" | "duration" | "consistency" | "energy";
  label: string;
  /** 0-100 for this component */
  value: number;
}

export interface SleepScore {
  score: number | null;
  label: ScoreLabel | null;
  parts: ScorePart[];
}

const WEIGHTS: Record<ScorePart["key"], number> = {
  debt: 0.35,
  duration: 0.3,
  consistency: 0.2,
  energy: 0.15,
};

export function scoreLabel(score: number): ScoreLabel {
  if (score >= 75) return "Good";
  if (score >= 50) return "Fair";
  return "Needs work";
}

/** Bedtime minutes shifted so evening times sort together (mirrors sleepDebt). */
function shiftedBedtime(iso: string): number {
  const d = new Date(iso);
  const mins = d.getHours() * 60 + d.getMinutes();
  return (mins - 17 * 60 + 24 * 60) % (24 * 60);
}

export function computeSleepScore(
  logs: SleepLog[],
  needHours: number = DEFAULT_SLEEP_NEED_HOURS,
  now: Date = new Date()
): SleepScore {
  const recent = logsInWindow(logs, now, DEBT_WINDOW_DAYS);
  if (recent.length === 0) return { score: null, label: null, parts: [] };

  const parts: ScorePart[] = [];

  // Debt: linear from 0h (100) to 20h (0)
  const debt = computeSleepDebt(logs, needHours, now);
  parts.push({
    key: "debt",
    label: "Sleep debt",
    value: Math.round(Math.max(0, 1 - debt / 20) * 100),
  });

  // Duration: average vs need, capped at 100
  const avg =
    recent.reduce((acc, l) => acc + hoursBetween(l.sleep_start, l.sleep_end), 0) / recent.length;
  parts.push({
    key: "duration",
    label: "Duration",
    value: Math.round(Math.min(avg / needHours, 1) * 100),
  });

  // Consistency: std dev of bedtimes; needs enough nights to mean anything
  if (recent.length >= 3) {
    const bedtimes = recent.map((l) => shiftedBedtime(l.sleep_start));
    const mean = bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length;
    const std = Math.sqrt(
      bedtimes.reduce((a, b) => a + (b - mean) ** 2, 0) / bedtimes.length
    );
    const value = std <= 30 ? 1 : std >= 180 ? 0 : 1 - (std - 30) / 150;
    parts.push({ key: "consistency", label: "Consistency", value: Math.round(value * 100) });
  }

  // Energy: self-reported 1-5, if any ratings exist
  const energies = recent
    .map((l) => l.energy_rating)
    .filter((e): e is number => e !== null && e >= 1 && e <= 5);
  if (energies.length > 0) {
    const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
    parts.push({
      key: "energy",
      label: "Energy",
      value: Math.round(((avgEnergy - 1) / 4) * 100),
    });
  }

  const totalWeight = parts.reduce((a, p) => a + WEIGHTS[p.key], 0);
  const score = Math.round(
    parts.reduce((a, p) => a + p.value * WEIGHTS[p.key], 0) / totalWeight
  );

  return { score, label: scoreLabel(score), parts };
}

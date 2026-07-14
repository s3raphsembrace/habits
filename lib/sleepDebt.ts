/**
 * Sleep debt engine — pure functions, no I/O, so every rule here is unit-testable.
 *
 * Model (deliberately simple and inspectable):
 * - Each night has a "sleep need" (default 8h, user-adjustable per profile).
 * - Nightly deficit = need - hours slept (negative = surplus).
 * - Sleep debt = sum of deficits over a rolling 14-day window, floored at 0
 *   and capped at 40h. Surplus nights (naps, lie-ins) pay debt down but can't
 *   bank credit below zero — matching how sleep research treats recovery.
 * - Melatonin window: melatonin onset begins roughly 2h before habitual
 *   bedtime, so we estimate it from the median bedtime of the last 7 logs.
 *   This is a heuristic, not a DLMO lab measurement.
 */

export const DEFAULT_SLEEP_NEED_HOURS = 8;
export const DEBT_WINDOW_DAYS = 14;
export const MAX_TRACKED_DEBT_HOURS = 40;

export interface SleepLog {
  /** ISO timestamp for when the user fell asleep */
  sleep_start: string;
  /** ISO timestamp for when the user woke up */
  sleep_end: string;
  /** Optional 1-5 self-reported energy the next day */
  energy_rating: number | null;
}

export interface SleepInsights {
  sleepDebtHours: number;
  avgSleepHours: number | null;
  avgEnergy: number | null;
  medianBedtime: string | null; // "HH:MM" local-style clock time
  medianWake: string | null; // "HH:MM"
  melatoninWindow: { start: string; end: string } | null; // "HH:MM"
  nightsLogged: number;
}

export function hoursBetween(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return ms / 3_600_000;
}

/** Nights whose sleep_end falls within the last `windowDays` days of `now`. */
export function logsInWindow(logs: SleepLog[], now: Date, windowDays: number): SleepLog[] {
  const cutoff = now.getTime() - windowDays * 24 * 3_600_000;
  return logs.filter((l) => new Date(l.sleep_end).getTime() >= cutoff);
}

export function computeSleepDebt(
  logs: SleepLog[],
  needHours: number = DEFAULT_SLEEP_NEED_HOURS,
  now: Date = new Date()
): number {
  const recent = logsInWindow(logs, now, DEBT_WINDOW_DAYS);
  const debt = recent.reduce((acc, log) => {
    const slept = hoursBetween(log.sleep_start, log.sleep_end);
    return acc + (needHours - slept);
  }, 0);
  return Math.min(Math.max(debt, 0), MAX_TRACKED_DEBT_HOURS);
}

const DAY_MIN = 24 * 60;
/** Bedtimes cluster around midnight, so shift the day boundary to 5pm. */
const BEDTIME_ANCHOR = 17 * 60;
/** Wake times cluster around morning, so shift the day boundary to 5am. */
const WAKE_ANCHOR = 5 * 60;

/** Minutes past midnight, shifted so times near the anchor sort together
 *  (e.g. with a 5pm anchor, 23:30 and 00:30 are numerically adjacent). */
function shiftedMinutes(iso: string, anchor: number): number {
  const d = new Date(iso);
  const mins = d.getHours() * 60 + d.getMinutes();
  return (mins - anchor + DAY_MIN) % DAY_MIN;
}

function minutesToClock(shifted: number, anchor: number): string {
  const mins = (shifted + anchor) % DAY_MIN;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function medianShifted(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function medianBedtime(logs: SleepLog[]): string | null {
  if (logs.length === 0) return null;
  const mid = medianShifted(logs.map((l) => shiftedMinutes(l.sleep_start, BEDTIME_ANCHOR)));
  return minutesToClock(mid, BEDTIME_ANCHOR);
}

export function medianWakeTime(logs: SleepLog[]): string | null {
  if (logs.length === 0) return null;
  const mid = medianShifted(logs.map((l) => shiftedMinutes(l.sleep_end, WAKE_ANCHOR)));
  return minutesToClock(mid, WAKE_ANCHOR);
}

/**
 * Melatonin starts rising ~2h before habitual bedtime and the "window" for
 * easiest sleep onset runs from then until ~1h after habitual bedtime.
 */
export function melatoninWindow(logs: SleepLog[]): { start: string; end: string } | null {
  if (logs.length === 0) return null;
  const mid = medianShifted(logs.map((l) => shiftedMinutes(l.sleep_start, BEDTIME_ANCHOR)));
  return {
    start: minutesToClock((mid - 120 + DAY_MIN) % DAY_MIN, BEDTIME_ANCHOR),
    end: minutesToClock((mid + 60) % DAY_MIN, BEDTIME_ANCHOR),
  };
}

export function computeInsights(
  logs: SleepLog[],
  needHours: number = DEFAULT_SLEEP_NEED_HOURS,
  now: Date = new Date()
): SleepInsights {
  const recent = logsInWindow(logs, now, DEBT_WINDOW_DAYS);
  const lastWeek = logsInWindow(logs, now, 7);

  const durations = recent.map((l) => hoursBetween(l.sleep_start, l.sleep_end));
  const energies = recent
    .map((l) => l.energy_rating)
    .filter((e): e is number => e !== null && e >= 1 && e <= 5);

  const avg = (xs: number[]) =>
    xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;

  return {
    sleepDebtHours: Math.round(computeSleepDebt(logs, needHours, now) * 10) / 10,
    avgSleepHours: avg(durations),
    avgEnergy: avg(energies),
    medianBedtime: medianBedtime(lastWeek),
    medianWake: medianWakeTime(lastWeek),
    melatoninWindow: melatoninWindow(lastWeek),
    nightsLogged: recent.length,
  };
}

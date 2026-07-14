/**
 * Models a 24h energy rhythm from habitual wake/bed times — pure functions,
 * no I/O. The curve is a two-process-style approximation (sleep inertia →
 * morning peak → afternoon dip → evening peak → wind-down → melatonin window
 * → sleep), NOT a measurement; it exists to make timing advice visual.
 *
 * All x positions are minutes from the chart's span start (wake − 2h), so the
 * span always covers a full 24h day with sleep anchored at the right edge.
 */

const DAY_MIN = 24 * 60;

export interface RhythmZone {
  label: string;
  from: number; // minutes from span start
  to: number;
}

export interface EnergyRhythm {
  /** Minutes-of-day at x = 0 (wake − 2h) */
  spanStart: number;
  /** Sampled curve: x minutes from span start (0..1440), y energy 0..100 */
  points: { x: number; y: number }[];
  zones: RhythmZone[];
  melatonin: { from: number; to: number };
  wakeX: number;
  bedX: number;
  wakeClock: string;
  bedClock: string;
  /** True when defaults were used because there aren't enough logs */
  estimated: boolean;
}

function parseClock(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function clockAt(spanStart: number, x: number): string {
  const mins = (spanStart + x + DAY_MIN) % DAY_MIN;
  const h24 = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  const suffix = h24 < 12 ? "a" : "p";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

/** Fritsch–Carlson monotone cubic interpolation — no overshoot between anchors. */
function monotoneCubic(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    slope.push((ys[i + 1] - ys[i]) / dx[i]);
  }
  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const t = (x - xs[i]) / dx[i];
    const h00 = (1 + 2 * t) * (1 - t) * (1 - t);
    const h10 = t * (1 - t) * (1 - t);
    const h01 = t * t * (3 - 2 * t);
    const h11 = t * t * (t - 1);
    return h00 * ys[i] + h10 * dx[i] * m[i] + h01 * ys[i + 1] + h11 * dx[i] * m[i + 1];
  };
}

export function buildRhythm(
  medianWake: string | null,
  medianBedtime: string | null
): EnergyRhythm {
  const estimated = medianWake === null || medianBedtime === null;
  const wakeMin = parseClock(medianWake ?? "07:00");
  let bedMin = parseClock(medianBedtime ?? "23:00");

  // Hours awake; guard against degenerate data (naps-only logs, etc.)
  let awake = (bedMin - wakeMin + DAY_MIN) % DAY_MIN;
  if (awake < 8 * 60 || awake > 20 * 60) {
    awake = 16 * 60;
    bedMin = (wakeMin + awake) % DAY_MIN;
  }

  const spanStart = (wakeMin - 120 + DAY_MIN) % DAY_MIN;
  const wakeX = 120;
  const bedX = wakeX + awake;
  const melFrom = bedX - 120; // melatonin onset ~2h before habitual bedtime
  const melTo = Math.min(bedX + 60, DAY_MIN);

  // Anchor times, squeezed left when the awake window is short so they stay ordered.
  const eveningPeak = Math.min(wakeX + 11 * 60, melFrom - 60);
  const afternoonDip = Math.min(wakeX + 7.5 * 60, eveningPeak - 90);
  const morningPeak = Math.min(wakeX + 3.5 * 60, afternoonDip - 90);

  const anchors: [number, number][] = [
    [0, 8],
    [80, 12],
    [wakeX, 32],
    [wakeX + 40, 26], // sleep inertia dip
    [morningPeak, 85],
    [afternoonDip, 55],
    [eveningPeak, 78],
    [melFrom, 50],
    [bedX, 24],
    [Math.min(bedX + 90, DAY_MIN - 10), 10],
    [DAY_MIN, 8],
  ];
  // Drop any anchor that isn't strictly after the previous one.
  const clean = anchors.filter(([x], i, arr) => i === 0 || x > arr[i - 1][0]);

  const f = monotoneCubic(
    clean.map(([x]) => x),
    clean.map(([, y]) => y)
  );
  const points: { x: number; y: number }[] = [];
  for (let x = 0; x <= DAY_MIN; x += 10) {
    points.push({ x, y: Math.max(0, Math.min(100, f(x))) });
  }

  const zones: RhythmZone[] = [
    { label: "Asleep", from: 0, to: wakeX },
    { label: "Grogginess", from: wakeX, to: wakeX + 60 },
    { label: "Morning peak", from: wakeX + 60, to: morningPeak + 60 },
    { label: "Afternoon dip", from: morningPeak + 60, to: afternoonDip + 60 },
    { label: "Evening peak", from: afternoonDip + 60, to: eveningPeak + 45 },
    { label: "Wind down", from: eveningPeak + 45, to: melFrom },
    { label: "Melatonin window", from: melFrom, to: melTo },
    { label: "Asleep", from: melTo, to: DAY_MIN },
  ];

  return {
    spanStart,
    points,
    zones,
    melatonin: { from: melFrom, to: melTo },
    wakeX,
    bedX,
    wakeClock: clockAt(spanStart, wakeX),
    bedClock: clockAt(spanStart, bedX),
    estimated,
  };
}

export function zoneAt(rhythm: EnergyRhythm, x: number): string {
  const zone = rhythm.zones.find((z) => x >= z.from && x < z.to);
  return zone?.label ?? "Asleep";
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildRhythm, clockAt, zoneAt } from "@/lib/energyRhythm";

const DAY_MIN = 24 * 60;

// Plot geometry (viewBox units)
const W = 720;
const H = 250;
const PLOT = { left: 12, right: 708, top: 26, bottom: 192 };
// Curve/band color comes from the --chart-line token (validated per theme),
// applied via CSS classes because var() doesn't work in SVG attributes.

interface Props {
  medianWake: string | null;
  medianBedtime: string | null;
  nightsLogged: number;
}

interface Hover {
  x: number; // viewBox x
  y: number; // viewBox y
  time: string;
  zone: string;
  energy: number;
}

export default function EnergyRhythmChart({ medianWake, medianBedtime, nightsLogged }: Props) {
  const rhythm = useMemo(() => buildRhythm(medianWake, medianBedtime), [medianWake, medianBedtime]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [nowX, setNowX] = useState<number | null>(null);

  // "Now" marker is client-only state so server and first client render match.
  useEffect(() => {
    const update = () => {
      const d = new Date();
      const mins = d.getHours() * 60 + d.getMinutes();
      setNowX((mins - rhythm.spanStart + DAY_MIN) % DAY_MIN);
    };
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [rhythm.spanStart]);

  const xScale = (min: number) =>
    PLOT.left + (min / DAY_MIN) * (PLOT.right - PLOT.left);
  const yScale = (energy: number) =>
    PLOT.bottom - (energy / 100) * (PLOT.bottom - PLOT.top);

  const linePath = rhythm.points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.x).toFixed(1)},${yScale(p.y).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${PLOT.right},${PLOT.bottom} L${PLOT.left},${PLOT.bottom} Z`;

  // Direct labels at the curve's extremum inside each named zone.
  const labels = useMemo(() => {
    const wanted: { zone: string; text: string; mode: "max" | "min" }[] = [
      { zone: "Morning peak", text: "Peak", mode: "max" },
      { zone: "Afternoon dip", text: "Dip", mode: "min" },
      { zone: "Evening peak", text: "Peak", mode: "max" },
      { zone: "Wind down", text: "Wind down", mode: "min" },
    ];
    return wanted.flatMap(({ zone, text, mode }) => {
      const z = rhythm.zones.find((c) => c.label === zone);
      if (!z) return [];
      const inside = rhythm.points.filter((p) => p.x >= z.from && p.x <= z.to);
      if (inside.length === 0) return [];
      const pick = inside.reduce((best, p) =>
        mode === "max" ? (p.y > best.y ? p : best) : (p.y < best.y ? p : best)
      );
      // "Wind down" sits mid-slope, not at an extremum
      const at = zone === "Wind down" ? inside[Math.floor(inside.length / 2)] : pick;
      return [{ x: xScale(at.x), y: yScale(at.y) - 10, text }];
    });
  }, [rhythm]);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const min = Math.max(0, Math.min(DAY_MIN, ((vx - PLOT.left) / (PLOT.right - PLOT.left)) * DAY_MIN));
    const nearest = rhythm.points.reduce((best, p) =>
      Math.abs(p.x - min) < Math.abs(best.x - min) ? p : best
    );
    setHover({
      x: xScale(nearest.x),
      y: yScale(nearest.y),
      time: clockAt(rhythm.spanStart, nearest.x),
      zone: zoneAt(rhythm, nearest.x),
      energy: Math.round(nearest.y),
    });
  }

  const ticks = [];
  for (let m = 0; m <= DAY_MIN; m += 180) ticks.push(m);

  const melX1 = xScale(rhythm.melatonin.from);
  const melX2 = xScale(rhythm.melatonin.to);

  return (
    <div className="card rhythm-card">
      <div className="rhythm-head">
        <p className="muted">
          Estimated from your habitual wake ({rhythm.wakeClock}) and bed ({rhythm.bedClock}) times
          — a model of your circadian energy, not a measurement.
        </p>
        {(rhythm.estimated || nightsLogged < 3) && (
          <p className="form-notice">Using typical times — log 3+ nights to personalize this curve.</p>
        )}
      </div>
      <div className="rhythm-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="rhythm-svg"
          role="img"
          aria-label={`Energy rhythm for today. Melatonin window ${clockAt(rhythm.spanStart, rhythm.melatonin.from)} to ${clockAt(rhythm.spanStart, rhythm.melatonin.to)}.`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* Melatonin window band */}
          <rect
            x={melX1}
            y={PLOT.top}
            width={Math.max(melX2 - melX1, 2)}
            height={PLOT.bottom - PLOT.top}
            className="rhythm-band"
            opacity={0.16}
            rx={4}
          />
          <text
            x={Math.min((melX1 + melX2) / 2, PLOT.right - 60)}
            y={PLOT.top - 8}
            textAnchor="middle"
            className="rhythm-label rhythm-label-mel"
          >
            Melatonin window
          </text>

          {/* Axis ticks (3h) */}
          {ticks.map((m) => (
            <g key={m}>
              <line
                x1={xScale(m)}
                y1={PLOT.bottom}
                x2={xScale(m)}
                y2={PLOT.bottom + 5}
                className="rhythm-tick"
              />
              <text x={xScale(m)} y={PLOT.bottom + 22} textAnchor="middle" className="rhythm-axis">
                {clockAt(rhythm.spanStart, m)}
              </text>
            </g>
          ))}
          <line
            x1={PLOT.left}
            y1={PLOT.bottom}
            x2={PLOT.right}
            y2={PLOT.bottom}
            className="rhythm-tick"
          />

          {/* Curve */}
          <path d={areaPath} className="rhythm-area" opacity={0.12} />
          <path d={linePath} fill="none" className="rhythm-line" strokeWidth={2} strokeLinecap="round" />

          {/* Direct labels */}
          {labels.map((l) => (
            <text key={`${l.text}-${l.x}`} x={l.x} y={l.y} textAnchor="middle" className="rhythm-label">
              {l.text}
            </text>
          ))}
          <text
            x={xScale((rhythm.melatonin.to + DAY_MIN) / 2)}
            y={yScale(12) - 10}
            textAnchor="middle"
            className="rhythm-label"
          >
            Sleep
          </text>

          {/* Now marker */}
          {nowX !== null && (
            <g>
              <line
                x1={xScale(nowX)}
                y1={PLOT.top}
                x2={xScale(nowX)}
                y2={PLOT.bottom}
                className="rhythm-now"
              />
              {/* Bottom-anchored so it never collides with the melatonin label at the top */}
              <text x={xScale(nowX)} y={PLOT.bottom - 8} textAnchor="middle" className="rhythm-label rhythm-label-now">
                Now
              </text>
            </g>
          )}

          {/* Hover crosshair */}
          {hover && (
            <g>
              <line x1={hover.x} y1={PLOT.top} x2={hover.x} y2={PLOT.bottom} className="rhythm-crosshair" />
              <circle cx={hover.x} cy={hover.y} r={4.5} className="rhythm-dot" strokeWidth={2} />
            </g>
          )}
        </svg>
        {hover && (
          <div
            className="rhythm-tooltip"
            style={{ left: `${(hover.x / W) * 100}%`, top: `${(Math.max(hover.y - 14, 0) / H) * 100}%` }}
          >
            <strong>{hover.time}</strong> · {hover.zone} · {hover.energy}% energy
          </div>
        )}
      </div>
    </div>
  );
}

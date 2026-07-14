"use client";

import type { SleepScore } from "@/lib/sleepScore";

// Semicircle geometry (viewBox units)
const CX = 100;
const CY = 100;
const R = 78;
const STROKE = 16;
const ARC_LEN = Math.PI * R;

// Status colors — always paired with the text label, never color-alone.
// Green validated on the dark surface (dataviz six-checks); red/yellow are
// the app's existing status tokens.
function statusColor(score: number): string {
  if (score >= 75) return "var(--good)";
  if (score >= 50) return "var(--warn)";
  return "var(--danger)";
}

export default function SleepScoreGauge({ score }: { score: SleepScore }) {
  const arcPath = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
  const value = score.score;

  return (
    <div className="card gauge-card">
      <svg
        viewBox="0 0 200 116"
        className="gauge-svg"
        role="img"
        aria-label={
          value === null
            ? "Sleep score unavailable — no nights logged yet"
            : `Sleep score ${value} out of 100 — ${score.label}`
        }
      >
        <path
          d={arcPath}
          fill="none"
          className="gauge-track"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {value !== null && (
          <path
            d={arcPath}
            fill="none"
            // style, not the stroke attribute: CSS var() only resolves in CSS
            style={{ stroke: statusColor(value) }}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={ARC_LEN}
            strokeDashoffset={(1 - value / 100) * ARC_LEN}
            className="gauge-value-arc"
          />
        )}
        <text x={CX} y={CY - 12} textAnchor="middle" className="gauge-number">
          {value ?? "—"}
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" className="gauge-sub">
          {value === null ? "no data yet" : "out of 100"}
        </text>
      </svg>

      {value === null ? (
        <p className="muted">Log a few nights and your score will appear here.</p>
      ) : (
        <>
          <p className="gauge-label" style={{ color: statusColor(value) }}>
            {score.label}
          </p>
          <p className="muted gauge-parts">
            {score.parts.map((p) => `${p.label} ${p.value}`).join(" · ")}
          </p>
        </>
      )}
    </div>
  );
}

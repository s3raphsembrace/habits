"use client";

import { useCallback, useEffect, useState } from "react";
import EnergyRhythmChart from "@/components/EnergyRhythmChart";
import NoisePlayer from "@/components/NoisePlayer";
import type { SleepInsights } from "@/lib/sleepDebt";
import type { Recommendation } from "@/lib/recommendations";

interface LogRow {
  id: string;
  sleep_start: string;
  sleep_end: string;
  energy_rating: number | null;
  note: string | null;
}

export default function DashboardView() {
  const [insights, setInsights] = useState<SleepInsights | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    // Auth travels in the session cookie — no headers needed.
    const [insightsRes, logsRes] = await Promise.all([
      fetch("/api/insights"),
      fetch("/api/sleep-logs"),
    ]);
    if (!insightsRes.ok || !logsRes.ok) {
      setError("Could not load your data. Check your connection and Supabase setup.");
      return;
    }
    const insightsBody = await insightsRes.json();
    const logsBody = await logsRes.json();
    setInsights(insightsBody.insights);
    setRecs(insightsBody.recommendations);
    setLogs(logsBody.logs);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function deleteLog(id: string) {
    const res = await fetch(`/api/sleep-logs/${id}`, { method: "DELETE" });
    if (res.ok) load();
    else setError("Could not delete that log.");
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <>
      <h1>Your sleep</h1>
      {error && <p className="form-error" role="alert">{error}</p>}

      {insights && (
        <section>
          <h2>Today&apos;s rhythm</h2>
          <EnergyRhythmChart
            medianWake={insights.medianWake}
            medianBedtime={insights.medianBedtime}
            nightsLogged={insights.nightsLogged}
          />
        </section>
      )}

      {insights && (
        <section className="stat-grid">
          <div className="card stat">
            <span className="stat-value">{insights.sleepDebtHours}h</span>
            <span className="stat-label">Sleep debt (14 days)</span>
          </div>
          <div className="card stat">
            <span className="stat-value">{insights.avgSleepHours ?? "—"}h</span>
            <span className="stat-label">Avg sleep / night</span>
          </div>
          <div className="card stat">
            <span className="stat-value">{insights.avgEnergy ?? "—"}/5</span>
            <span className="stat-label">Avg energy</span>
          </div>
          <div className="card stat">
            <span className="stat-value">
              {insights.melatoninWindow
                ? `${insights.melatoninWindow.start}–${insights.melatoninWindow.end}`
                : "—"}
            </span>
            <span className="stat-label">Melatonin window</span>
          </div>
        </section>
      )}

      <section>
        <h2>Recommendations</h2>
        <div className="stack">
          {recs.map((r) => (
            <div key={r.title} className={`card rec rec-${r.severity}`}>
              <h3>{r.title}</h3>
              <p>{r.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Wind down</h2>
        <NoisePlayer />
      </section>

      <section>
        <h2>Recent nights</h2>
        {logs.length === 0 ? (
          <p className="muted">No nights logged yet — add your first from “Log sleep”.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fell asleep</th>
                  <th>Woke up</th>
                  <th>Energy</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{fmt(l.sleep_start)}</td>
                    <td>{fmt(l.sleep_end)}</td>
                    <td>{l.energy_rating ? `${l.energy_rating}/5` : "—"}</td>
                    <td>
                      <button className="link-button danger" onClick={() => deleteLog(l.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

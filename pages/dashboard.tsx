import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import NoisePlayer from "@/components/NoisePlayer";
import { apiFetch, useSession } from "@/lib/useSession";
import type { SleepInsights } from "@/lib/sleepDebt";
import type { Recommendation } from "@/lib/recommendations";

interface LogRow {
  id: string;
  sleep_start: string;
  sleep_end: string;
  energy_rating: number | null;
  note: string | null;
}

export default function Dashboard() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [insights, setInsights] = useState<SleepInsights | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const load = useCallback(async () => {
    setError(null);
    const [insightsRes, logsRes] = await Promise.all([
      apiFetch("/api/insights"),
      apiFetch("/api/sleep-logs"),
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
    if (session) load();
  }, [session, load]);

  async function deleteLog(id: string) {
    const res = await apiFetch(`/api/sleep-logs/${id}`, { method: "DELETE" });
    if (res.ok) load();
    else setError("Could not delete that log.");
  }

  if (loading || !session) return null;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <Layout title="Dashboard">
      <h1>Your sleep</h1>
      {error && <p className="form-error" role="alert">{error}</p>}

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
    </Layout>
  );
}

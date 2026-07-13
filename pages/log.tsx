import { useRouter } from "next/router";
import { FormEvent, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { apiFetch, useSession } from "@/lib/useSession";

/** Converts a datetime-local input value to an ISO string with offset. */
function localToIso(local: string): string {
  return new Date(local).toISOString();
}

export default function LogSleep() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [sleepStart, setSleepStart] = useState("");
  const [sleepEnd, setSleepEnd] = useState("");
  const [energy, setEnergy] = useState<string>("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!sleepStart || !sleepEnd) {
      setError("Both times are required.");
      return;
    }
    if (new Date(sleepEnd) <= new Date(sleepStart)) {
      setError("Wake time must be after sleep time.");
      return;
    }

    setBusy(true);
    const res = await apiFetch("/api/sleep-logs", {
      method: "POST",
      body: JSON.stringify({
        sleep_start: localToIso(sleepStart),
        sleep_end: localToIso(sleepEnd),
        energy_rating: energy ? Number(energy) : null,
        note: note.trim() || undefined,
      }),
    });
    setBusy(false);

    if (res.ok) {
      router.push("/dashboard");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save the log.");
    }
  }

  if (loading || !session) return null;

  return (
    <Layout title="Log sleep">
      <div className="narrow">
        <h1>Log a night (or a nap)</h1>
        <form onSubmit={onSubmit} className="stack" noValidate>
          <label>
            Fell asleep at
            <input
              type="datetime-local"
              value={sleepStart}
              onChange={(e) => setSleepStart(e.target.value)}
              required
            />
          </label>
          <label>
            Woke up at
            <input
              type="datetime-local"
              value={sleepEnd}
              onChange={(e) => setSleepEnd(e.target.value)}
              required
            />
          </label>
          <label>
            Energy today (optional)
            <select value={energy} onChange={(e) => setEnergy(e.target.value)}>
              <option value="">Not rated</option>
              <option value="1">1 — Exhausted</option>
              <option value="2">2 — Dragging</option>
              <option value="3">3 — OK</option>
              <option value="4">4 — Good</option>
              <option value="5">5 — Energized</option>
            </select>
          </label>
          <label>
            Note (optional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Late coffee, stressful day…"
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </Layout>
  );
}

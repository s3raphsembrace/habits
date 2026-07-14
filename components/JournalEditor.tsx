"use client";

import { useCallback, useEffect, useState } from "react";

interface NoteFields {
  activities: string;
  meals: string;
  goals: string;
  notes: string;
}

const EMPTY: NoteFields = { activities: "", meals: "", goals: "", notes: "" };

const SECTIONS: { key: keyof NoteFields; label: string; placeholder: string }[] = [
  { key: "activities", label: "Activities", placeholder: "Workout at 6pm, long walk, late screen time…" },
  { key: "meals", label: "Meals", placeholder: "Coffee at 3pm, heavy dinner at 9pm…" },
  { key: "goals", label: "Goals", placeholder: "In bed by 11, no phone after 10:30…" },
  { key: "notes", label: "Notes", placeholder: "Anything else about today…" },
];

/** Local (not UTC) YYYY-MM-DD, so "today" matches the user's clock. */
function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return toDateString(date);
}

export default function JournalEditor() {
  const [date, setDate] = useState(() => toDateString(new Date()));
  const [fields, setFields] = useState<NoteFields>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    setSavedAt(null);
    const res = await fetch(`/api/notes?date=${d}`);
    if (res.ok) {
      const body = await res.json();
      setFields({ ...EMPTY, ...body.note });
      setDirty(false);
    } else {
      setError("Could not load this day. Have you run supabase/migrations/002_daily_notes.sql?");
      setFields(EMPTY);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, ...fields }),
    });
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }));
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save.");
    }
  }

  const today = toDateString(new Date());
  const displayDate = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <h1>Journal</h1>
      <p className="muted">
        What you do, eat, and aim for each day — so you can connect your habits to your sleep.
      </p>

      <div className="date-nav">
        <button className="button" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          ‹
        </button>
        <div className="date-nav-current">
          <strong>{date === today ? "Today" : displayDate}</strong>
          {date !== today && (
            <button className="link-button" onClick={() => setDate(today)}>
              Jump to today
            </button>
          )}
        </div>
        <button
          className="button"
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= today}
          aria-label="Next day"
        >
          ›
        </button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="journal-grid">
        {SECTIONS.map((s) => (
          <label key={s.key}>
            {s.label}
            <textarea
              value={fields[s.key]}
              onChange={(e) => {
                setFields({ ...fields, [s.key]: e.target.value });
                setDirty(true);
              }}
              placeholder={s.placeholder}
              maxLength={2000}
              rows={5}
              disabled={loading}
            />
          </label>
        ))}
      </div>

      <div className="journal-actions">
        <button className="button primary" onClick={save} disabled={saving || loading || !dirty}>
          {saving ? "Saving…" : "Save"}
        </button>
        <span className="muted">
          {dirty ? "Unsaved changes" : savedAt ? `Saved at ${savedAt}` : loading ? "Loading…" : ""}
        </span>
      </div>
    </>
  );
}

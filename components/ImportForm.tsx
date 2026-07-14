"use client";

import { useState } from "react";
import posthog from "posthog-js";

interface Session {
  sleep_start: string;
  sleep_end: string;
}

/** "2024-01-01 23:00:00 -0500" (Apple Health) -> "2024-01-01T23:00:00-05:00" */
function appleDateToIso(s: string): string | null {
  const m = s.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-])(\d{2})(\d{2})$/);
  if (!m) return null;
  return `${m[1]}T${m[2]}${m[3]}${m[4]}:${m[5]}`;
}

/** Merge sleep-stage fragments separated by short gaps into whole sessions. */
function mergeFragments(fragments: { start: number; end: number }[], gapMs = 30 * 60_000): Session[] {
  const sorted = [...fragments].sort((a, b) => a.start - b.start);
  const sessions: { start: number; end: number }[] = [];
  for (const f of sorted) {
    const last = sessions[sessions.length - 1];
    if (last && f.start - last.end <= gapMs) last.end = Math.max(last.end, f.end);
    else sessions.push({ ...f });
  }
  return sessions
    .filter((s) => {
      const dur = s.end - s.start;
      return dur >= 10 * 60_000 && dur <= 24 * 3_600_000;
    })
    .map((s) => ({
      sleep_start: new Date(s.start).toISOString(),
      sleep_end: new Date(s.end).toISOString(),
    }));
}

function parseAppleHealthXml(text: string): Session[] {
  const fragments: { start: number; end: number }[] = [];
  const recordRe = /<Record\b[^>]*type="HKCategoryTypeIdentifierSleepAnalysis"[^>]*>/g;
  for (const match of text.matchAll(recordRe)) {
    const tag = match[0];
    // Skip "InBed" records — they overlap the actual asleep stages.
    const value = tag.match(/value="([^"]*)"/)?.[1] ?? "";
    if (!value.includes("Asleep")) continue;
    const startRaw = tag.match(/startDate="([^"]*)"/)?.[1];
    const endRaw = tag.match(/endDate="([^"]*)"/)?.[1];
    if (!startRaw || !endRaw) continue;
    const startIso = appleDateToIso(startRaw);
    const endIso = appleDateToIso(endRaw);
    if (!startIso || !endIso) continue;
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      fragments.push({ start, end });
    }
  }
  return mergeFragments(fragments);
}

function parseCsv(text: string): Session[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const startIdx = header.findIndex((h) => h === "sleep_start" || h === "start" || h.includes("start"));
  const endIdx = header.findIndex((h) => h === "sleep_end" || h === "end" || h.includes("end"));
  if (startIdx === -1 || endIdx === -1) return [];

  const fragments: { start: number; end: number }[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const start = new Date(cols[startIdx]).getTime();
    const end = new Date(cols[endIdx]).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      fragments.push({ start, end });
    }
  }
  return mergeFragments(fragments);
}

export default function ImportForm() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setSessions([]);
    setFileName(file.name);
    setParsing(true);
    try {
      const text = await file.text();
      const parsed = text.includes("HKCategoryTypeIdentifierSleepAnalysis")
        ? parseAppleHealthXml(text)
        : parseCsv(text);
      if (parsed.length === 0) {
        setError(
          "No sleep sessions found. Expected an Apple Health export.xml or a CSV with start/end columns."
        );
      } else {
        const isAppleHealth = text.includes("HKCategoryTypeIdentifierSleepAnalysis");
        posthog.capture("sleep_import_file_parsed", {
          sessions_found: parsed.length,
          source: isAppleHealth ? "apple_health" : "csv",
        });
      }
      setSessions(parsed);
    } catch (err) {
      posthog.captureException(err);
      setError("Could not read that file.");
    }
    setParsing(false);
  }

  async function importAll() {
    setBusy(true);
    setError(null);
    let imported = 0;
    let skipped = 0;
    // The API caps batches at 500 sessions.
    for (let i = 0; i < sessions.length; i += 400) {
      const res = await fetch("/api/sleep-logs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions: sessions.slice(i, i + 400) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Import failed partway through — you can safely retry.");
        setBusy(false);
        return;
      }
      const body = await res.json();
      imported += body.imported;
      skipped += body.skipped;
    }
    posthog.capture("sleep_import_completed", {
      imported,
      skipped,
    });
    setResult({ imported, skipped });
    setSessions([]);
    setBusy(false);
  }

  return (
    <div className="narrow">
      <h1>Import sleep data</h1>
      <p className="muted">
        Live Apple Health / Fitbit / Oura sync needs a phone app (it&apos;s on our roadmap), but you
        can import your history today: on iPhone open Health → your profile picture →{" "}
        <strong>Export All Health Data</strong>, unzip it, and upload the <code>export.xml</code>{" "}
        here. CSVs with <code>start</code>/<code>end</code> columns work too. Files are parsed in
        your browser — only the sleep sessions are uploaded.
      </p>

      <div className="stack">
        <label>
          Export file (.xml or .csv)
          <input type="file" accept=".xml,.csv,text/xml,text/csv" onChange={onFile} />
        </label>

        {parsing && <p className="muted">Parsing {fileName}… large exports can take a moment.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}

        {sessions.length > 0 && (
          <div className="card">
            <p>
              Found <strong>{sessions.length}</strong> sleep session{sessions.length === 1 ? "" : "s"} in{" "}
              {fileName}, from{" "}
              {new Date(sessions[0].sleep_start).toLocaleDateString()} to{" "}
              {new Date(sessions[sessions.length - 1].sleep_end).toLocaleDateString()}.
            </p>
            <p className="muted">Already-logged nights are skipped automatically, so re-importing is safe.</p>
            <button className="button primary" onClick={importAll} disabled={busy}>
              {busy ? "Importing…" : `Import ${sessions.length} sessions`}
            </button>
          </div>
        )}

        {result && (
          <p className="form-notice">
            Imported {result.imported} session{result.imported === 1 ? "" : "s"}
            {result.skipped > 0 ? `, skipped ${result.skipped} already logged` : ""}. Head to your
            dashboard to see the updated numbers.
          </p>
        )}
      </div>
    </div>
  );
}

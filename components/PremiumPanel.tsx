"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { applyPreset, clearPreset, isPresetKey, THEME_PRESETS, type ThemePresetKey } from "@/lib/themePresets";

const FEATURES = [
  "Conversational AI coach — unlimited questions, grounded in your data",
  "Theme colors — five palettes for light and dark mode",
  "Oura auto-sync — pull sleep straight from the Oura API",
  "Everything in free: logging, sleep debt, score, rhythm chart, journal, imports",
];

export default function PremiumPanel() {
  const [loading, setLoading] = useState(true);
  const [premium, setPremium] = useState(false);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [preset, setPreset] = useState<ThemePresetKey>("cream");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    // Checkout returns here with ?status=success|cancelled
    const status = new URLSearchParams(window.location.search).get("status");
    if (status === "success") setNotice("Payment received! Premium activates within a few seconds of Stripe's confirmation — refresh if you don't see it yet.");
    if (status === "cancelled") setNotice("Checkout cancelled — no charge was made.");

    (async () => {
      const supabase = supabaseBrowser();
      const [billing, profile] = await Promise.all([
        supabase.from("billing_customers").select("is_premium, current_period_end").maybeSingle(),
        supabase.from("profiles").select("theme_preset").maybeSingle(),
      ]);
      const isP =
        Boolean(billing.data?.is_premium) &&
        (!billing.data?.current_period_end ||
          new Date(billing.data.current_period_end) >= new Date());
      setPremium(isP);
      setPeriodEnd(billing.data?.current_period_end ?? null);
      const p = profile.data?.theme_preset;
      if (p && isPresetKey(p)) setPreset(p);
      setLoading(false);
    })();
  }, []);

  async function goTo(path: "/api/stripe/checkout" | "/api/stripe/portal") {
    setBusy(true);
    setError(null);
    const res = await fetch(path, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && body.url) window.location.href = body.url;
    else setError(body.error ?? "Something went wrong.");
  }

  async function pickPreset(key: ThemePresetKey) {
    if (!premium) return;
    setPreset(key);
    if (key === "cream") clearPreset();
    else applyPreset(key);
    try {
      localStorage.setItem("themePreset", key);
    } catch {}
    const supabase = supabaseBrowser();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase
        .from("profiles")
        .upsert({ user_id: data.user.id, theme_preset: key }, { onConflict: "user_id" });
    }
  }

  return (
    <div className="narrow">
      <h1>Premium</h1>
      {notice && <p className="form-notice">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="card">
        {loading ? (
          <p className="muted">Loading your plan…</p>
        ) : premium ? (
          <>
            <p>
              <strong style={{ color: "var(--good)" }}>✓ Premium active</strong>
              {periodEnd && (
                <span className="muted"> · renews/ends {new Date(periodEnd).toLocaleDateString()}</span>
              )}
            </p>
            <button className="button" onClick={() => goTo("/api/stripe/portal")} disabled={busy}>
              Manage subscription
            </button>
          </>
        ) : (
          <>
            <h3>Upgrade to Premium</h3>
            <ul className="premium-features">
              {FEATURES.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <button className="button primary" onClick={() => goTo("/api/stripe/checkout")} disabled={busy}>
              {busy ? "Opening checkout…" : "Upgrade"}
            </button>
            <p className="muted">Secure checkout by Stripe. Cancel anytime from this page.</p>
          </>
        )}
      </div>

      <h2>Theme color</h2>
      <div className="card">
        {!premium && (
          <p className="muted">Theme colors are a Premium feature — the default cream stays free.</p>
        )}
        <div className="preset-row">
          {(Object.keys(THEME_PRESETS) as ThemePresetKey[]).map((key) => (
            <button
              key={key}
              className={`preset-swatch ${preset === key ? "selected" : ""}`}
              style={{ background: THEME_PRESETS[key].light.accent }}
              onClick={() => pickPreset(key)}
              disabled={!premium}
              aria-label={THEME_PRESETS[key].label}
              title={THEME_PRESETS[key].label}
            />
          ))}
        </div>
        <p className="muted">{THEME_PRESETS[preset].label}</p>
      </div>

      <h2>Integrations</h2>
      <div className="card">
        <p>
          <strong>Oura</strong> auto-sync lives on the <Link href="/import">Import page</Link> —
          paste a personal access token there and your nights sync from the Oura API
          {premium ? "." : " (Premium)."}
        </p>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";
import posthog from "posthog-js";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!supabaseConfigured()) {
      setError("Supabase is not configured yet — copy .env.local.example to .env.local first.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    const supabase = supabaseBrowser();
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        posthog.captureException(error, { extra: { context: "signup" } });
      } else {
        if (data.user) {
          posthog.identify(data.user.id);
          posthog.capture("user_signed_up", { method: "email" });
        }
        setNotice("Account created. Check your email if confirmation is enabled, then sign in.");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        posthog.captureException(error, { extra: { context: "signin" } });
      } else {
        if (data.user) {
          posthog.identify(data.user.id);
          posthog.capture("user_signed_in", { method: "email" });
        }
        // refresh() re-runs middleware/server components with the new cookie
        router.push("/dashboard");
        router.refresh();
      }
    }
    setBusy(false);
  }

  return (
    <div className="narrow">
      <h1>{mode === "signin" ? "Sign in" : "Create your account"}</h1>
      <form onSubmit={onSubmit} className="stack" noValidate>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-notice">{notice}</p>}
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>
      <p className="muted">
        {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
        <button
          className="link-button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Create one" : "Sign in instead"}
        </button>
      </p>
    </div>
  );
}

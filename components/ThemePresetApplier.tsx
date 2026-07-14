"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { applyPreset, clearPreset, isPresetKey } from "@/lib/themePresets";

/**
 * Applies the signed-in user's premium theme preset app-wide. Renders
 * nothing. Uses the localStorage cache for an instant apply, then verifies
 * premium + preset from the database (server-enforced billing table).
 * Re-applies when the light/dark toggle flips, since presets differ per mode.
 */
export default function ThemePresetApplier() {
  useEffect(() => {
    let current: string | null = null;

    const apply = (key: string | null) => {
      current = key;
      if (key && key !== "cream" && isPresetKey(key)) applyPreset(key);
      else clearPreset();
    };

    // Instant (unverified) apply from cache to avoid a color flash
    try {
      apply(localStorage.getItem("themePreset"));
    } catch {}

    // Verify against the database
    (async () => {
      const supabase = supabaseBrowser();
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session) {
        apply(null);
        return;
      }
      const [billing, profile] = await Promise.all([
        supabase.from("billing_customers").select("is_premium, current_period_end").maybeSingle(),
        supabase.from("profiles").select("theme_preset").maybeSingle(),
      ]);
      const premium =
        Boolean(billing.data?.is_premium) &&
        (!billing.data?.current_period_end ||
          new Date(billing.data.current_period_end) >= new Date());
      const key = premium ? profile.data?.theme_preset ?? null : null;
      apply(key);
      try {
        if (key && key !== "cream") localStorage.setItem("themePreset", key);
        else localStorage.removeItem("themePreset");
      } catch {}
    })();

    // Presets have per-mode values — reapply when the ☀/🌙 toggle changes
    const observer = new MutationObserver(() => apply(current));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const { data: sub } = supabaseBrowser().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        apply(null);
        try {
          localStorage.removeItem("themePreset");
        } catch {}
      }
    });

    return () => {
      observer.disconnect();
      sub.subscription.unsubscribe();
    };
  }, []);

  return null;
}

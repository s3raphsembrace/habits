/**
 * Premium theme presets: a page-background tint plus an accent pair, per
 * light/dark mode. Accents are contrast-validated (>=3:1) against both
 * surfaces; the chart line and status colors stay on their own validated
 * tokens and are NOT changed by presets.
 */
export const THEME_PRESETS = {
  cream: {
    label: "Cream (default)",
    light: { bg: "#eeefe9", accent: "#f54e00", accentStrong: "#d84300" },
    dark: { bg: "#1c1c1a", accent: "#f0703a", accentStrong: "#e05a26" },
  },
  lavender: {
    label: "Lavender",
    light: { bg: "#eeecf6", accent: "#6a5be0", accentStrong: "#5747c9" },
    dark: { bg: "#1c1b21", accent: "#8d7ff0", accentStrong: "#7c6ce8" },
  },
  mint: {
    label: "Mint",
    light: { bg: "#e9f2ec", accent: "#0f8a5f", accentStrong: "#0c7450" },
    dark: { bg: "#1a1f1c", accent: "#2fa87d", accentStrong: "#279068" },
  },
  sky: {
    label: "Sky",
    light: { bg: "#e9eff5", accent: "#0b7fbf", accentStrong: "#096a9f" },
    dark: { bg: "#1a1d20", accent: "#3fa3e0", accentStrong: "#2f8fc9" },
  },
  rose: {
    label: "Rose",
    light: { bg: "#f5ecf0", accent: "#c2366b", accentStrong: "#a52c5a" },
    dark: { bg: "#201b1d", accent: "#d95f8d", accentStrong: "#c94f7d" },
  },
} as const;

export type ThemePresetKey = keyof typeof THEME_PRESETS;

export function isPresetKey(v: string): v is ThemePresetKey {
  return v in THEME_PRESETS;
}

/** Sets the preset's CSS variables on <html> for the active light/dark mode. */
export function applyPreset(key: ThemePresetKey) {
  const mode = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const p = THEME_PRESETS[key][mode];
  const root = document.documentElement.style;
  root.setProperty("--bg", p.bg);
  root.setProperty("--accent", p.accent);
  root.setProperty("--accent-strong", p.accentStrong);
}

export function clearPreset() {
  const root = document.documentElement.style;
  root.removeProperty("--bg");
  root.removeProperty("--accent");
  root.removeProperty("--accent-strong");
}

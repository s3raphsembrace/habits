import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, Session } from "@supabase/supabase-js";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { API_BASE, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true },
});

/** fetch() against the web app's REST API, authenticated with the JWT. */
async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      ...(init.headers ?? {}),
    },
  });
}

// ---------------------------------------------------------------------------

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState<"home" | "log">("home");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (booting) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color="#f54e00" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.brand}>🌙 Habits</Text>
        {session && (
          <Pressable onPress={() => supabase.auth.signOut()}>
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        )}
      </View>

      {!session ? (
        <Login />
      ) : (
        <>
          <ScrollView style={styles.body}>{tab === "home" ? <Dashboard /> : <LogSleep onSaved={() => setTab("home")} />}</ScrollView>
          <View style={styles.tabs}>
            <TabButton label="Dashboard" active={tab === "home"} onPress={() => setTab("home")} />
            <TabButton label="Log sleep" active={tab === "log"} onPress={() => setTab("log")} />
          </View>
        </>
      )}
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const fn =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <View style={styles.body}>
      <Text style={styles.h1}>{mode === "signin" ? "Sign in" : "Create account"}</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (8+ characters)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.buttonPrimary} onPress={submit} disabled={busy}>
        <Text style={styles.buttonPrimaryText}>{busy ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}</Text>
      </Pressable>
      <Pressable onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
        <Text style={styles.link}>{mode === "signin" ? "No account? Create one" : "Have an account? Sign in"}</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------

interface Insights {
  sleepDebtHours: number;
  avgSleepHours: number | null;
  medianBedtime: string | null;
  melatoninWindow: { start: string; end: string } | null;
}

function Dashboard() {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [score, setScore] = useState<{ score: number | null; label: string | null } | null>(null);
  const [recs, setRecs] = useState<{ title: string; body: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api("/api/insights");
      if (!res.ok) throw new Error(`API ${res.status} — check API_BASE in config.ts`);
      const body = await res.json();
      setInsights(body.insights);
      setScore(body.sleepScore ?? null);
      setRecs(body.recommendations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View>
      <Text style={styles.h1}>Your sleep</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {score?.score != null && (
        <View style={styles.card}>
          <Text style={styles.scoreBig}>{score.score}</Text>
          <Text style={styles.mutedCenter}>Sleep score · {score.label}</Text>
        </View>
      )}
      {insights && (
        <View style={styles.card}>
          <Row label="Sleep debt (14d)" value={`${insights.sleepDebtHours}h`} />
          <Row label="Avg sleep" value={insights.avgSleepHours != null ? `${insights.avgSleepHours}h` : "—"} />
          <Row label="Habitual bedtime" value={insights.medianBedtime ?? "—"} />
          <Row
            label="Melatonin window"
            value={insights.melatoninWindow ? `${insights.melatoninWindow.start}–${insights.melatoninWindow.end}` : "—"}
          />
        </View>
      )}
      {recs.map((r) => (
        <View key={r.title} style={styles.card}>
          <Text style={styles.cardTitle}>{r.title}</Text>
          <Text style={styles.cardBody}>{r.body}</Text>
        </View>
      ))}
      <Pressable style={styles.button} onPress={load}>
        <Text style={styles.buttonText}>Refresh</Text>
      </Pressable>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

/** Builds an ISO timestamp from "HH:MM" on today or yesterday. */
function isoAt(hhmm: string, daysAgo: 0 | 1): string | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.toISOString();
}

function LogSleep({ onSaved }: { onSaved: () => void }) {
  const [bed, setBed] = useState("23:00");
  const [wake, setWake] = useState("07:00");
  const [energy, setEnergy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    // Bedtimes after noon are assumed to be yesterday evening
    const bedIsYesterday = Number(bed.split(":")[0]) >= 12 ? 1 : 0;
    const start = isoAt(bed, bedIsYesterday as 0 | 1);
    const end = isoAt(wake, 0);
    if (!start || !end) {
      setError("Times must be HH:MM, e.g. 23:15");
      return;
    }
    if (new Date(end) <= new Date(start)) {
      setError("Wake time must be after bedtime.");
      return;
    }
    setBusy(true);
    const res = await api("/api/sleep-logs", {
      method: "POST",
      body: JSON.stringify({ sleep_start: start, sleep_end: end, energy_rating: energy }),
    });
    setBusy(false);
    if (res.ok) onSaved();
    else {
      const body = await res.json().catch(() => ({} as any));
      setError(body.error ?? "Could not save.");
    }
  }

  return (
    <View>
      <Text style={styles.h1}>Log last night</Text>
      <Text style={styles.muted}>Fell asleep at (HH:MM, evening = yesterday)</Text>
      <TextInput style={styles.input} value={bed} onChangeText={setBed} keyboardType="numbers-and-punctuation" />
      <Text style={styles.muted}>Woke up at (HH:MM, today)</Text>
      <TextInput style={styles.input} value={wake} onChangeText={setWake} keyboardType="numbers-and-punctuation" />
      <Text style={styles.muted}>Energy today</Text>
      <View style={styles.energyRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            style={[styles.energyDot, energy === n && styles.energyDotActive]}
            onPress={() => setEnergy(energy === n ? null : n)}
          >
            <Text style={energy === n ? styles.energyTextActive : styles.energyText}>{n}</Text>
          </Pressable>
        ))}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.buttonPrimary} onPress={save} disabled={busy}>
        <Text style={styles.buttonPrimaryText}>{busy ? "Saving…" : "Save"}</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------

const C = {
  bg: "#eeefe9",
  surface: "#ffffff",
  border: "#d6d5cc",
  text: "#151515",
  muted: "#5e5e58",
  accent: "#f54e00",
  danger: "#d43a47",
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingTop: 56 },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  brand: { fontSize: 18, fontWeight: "700", color: C.text },
  body: { flex: 1, padding: 16 },
  h1: { fontSize: 24, fontWeight: "700", color: C.text, marginBottom: 12 },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { fontWeight: "700", color: C.text, marginBottom: 4 },
  cardBody: { color: C.muted, lineHeight: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  rowValue: { fontWeight: "700", color: C.text },
  scoreBig: { fontSize: 44, fontWeight: "700", color: C.accent, textAlign: "center" },
  muted: { color: C.muted, marginBottom: 4 },
  mutedCenter: { color: C.muted, textAlign: "center" },
  link: { color: C.accent, fontWeight: "600", marginTop: 8 },
  error: { color: C.danger, fontWeight: "600", marginVertical: 6 },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    color: C.text,
  },
  button: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginVertical: 8,
  },
  buttonText: { fontWeight: "600", color: C.text },
  buttonPrimary: {
    backgroundColor: C.accent,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginVertical: 8,
  },
  buttonPrimaryText: { color: "#fff", fontWeight: "700" },
  tabs: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
  tab: { flex: 1, padding: 14, alignItems: "center" },
  tabActive: { borderTopWidth: 2, borderTopColor: C.accent },
  tabText: { color: C.muted, fontWeight: "600" },
  tabTextActive: { color: C.text },
  energyRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  energyDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  energyDotActive: { backgroundColor: C.accent, borderColor: C.accent },
  energyText: { color: C.muted, fontWeight: "600" },
  energyTextActive: { color: "#fff", fontWeight: "700" },
});

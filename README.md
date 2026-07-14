# Habits: Sleep Quality — sleep debt & energy tracker

Habits: Sleep Quality (formerly Somnia) calculates your **sleep debt** (rolling 14-day ledger of sleep owed vs. slept),
estimates your **melatonin window** from your habitual bedtime, tracks self-reported
**energy**, and turns the numbers into concrete recommendations. It also ships a
dependency-free brown-noise generator for winding down and a sleep science library.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript 5 | Requires Node 20.9+ (see `engines`) |
| Backend | Next.js route handlers (REST) | `app/api/*/route.ts` |
| Database + Auth | Supabase (Postgres + cookie sessions via `@supabase/ssr`) | Row Level Security is the real authorization layer |
| Validation | zod (server) + HTML/JS checks (client) | Client checks are UX; zod + DB constraints are the gate |
| Styling | Single global CSS file, mobile-first | No CSS framework needed at this size |

## Getting started

1. `npm install`
2. Create a free project at [supabase.com](https://supabase.com), then run the **contents of**
   `supabase/schema.sql` in the SQL Editor (dashboard → SQL Editor → paste → Run).
   Already ran an older schema? Run only the new files in `supabase/migrations/` instead.
3. Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (dashboard → Project Settings → API).
4. `npm run dev` → http://localhost:3000
5. (Optional, for quick local testing) In Supabase → Authentication → Providers → Email,
   disable "Confirm email" so sign-ups work instantly without an email loop.

## Architecture in one paragraph

`@supabase/ssr` stores the auth session in **cookies**, so the browser, the proxy
(`proxy.ts`), server components, and REST route handlers all see the same auth state.
The proxy refreshes expired sessions and redirects unauthenticated visitors away from
`/dashboard` and `/log` server-side. Route handlers build a per-request Supabase client
from those cookies, so **Postgres Row Level Security evaluates every query as the
user** — even a buggy handler cannot touch another user's rows. Non-browser clients
(the planned mobile app) can instead send `Authorization: Bearer <jwt>`; both paths end
at the same RLS policies (`lib/supabase/server.ts`). Sleep math lives in
`lib/sleepDebt.ts` as pure functions, and `lib/recommendations.ts` maps the numbers to
advice via explicit thresholds.

## Layout

```
app/                 pages (server components) + REST API route handlers
  api/*/route.ts     REST endpoints: sleep-logs (+/import), insights, notes, contact
components/          client components ("use client"): forms, nav, dashboard, chart, noise player
lib/sleepDebt.ts     sleep debt / melatonin window / median wake math (pure, testable)
lib/energyRhythm.ts  24h circadian energy curve model for the dashboard chart
lib/recommendations.ts  threshold -> advice rules
lib/supabase/        browser + server Supabase clients
proxy.ts             session refresh + server-side route protection
supabase/schema.sql  full fresh-install schema (tables, constraints, RLS policies)
supabase/migrations/ incremental changes if you already ran an older schema
```

## Importing wearable / phone data

Live HealthKit/Fitbit/Oura sync requires a native phone app (roadmap). Today, **/import**
ingests exports: on iPhone, Health app → profile picture → *Export All Health Data* →
unzip → upload `export.xml`. Fitbit/Oura CSVs with start/end columns also work. Parsing
happens in the browser; sleep-stage fragments are merged into sessions and POSTed to
`/api/sleep-logs/import`, which skips nights already logged (re-importing is safe).

## Dashboard rhythm chart

`lib/energyRhythm.ts` models a 24h energy curve (grogginess → morning peak → afternoon
dip → evening peak → wind-down → melatonin window → sleep) from your median wake/bed
times; `components/EnergyRhythmChart.tsx` renders it as a horizontal SVG timeline with
a hover tooltip. It's a model for timing guidance, not a measurement, and says so in
the UI. The chart color (`#6478f0`) is validated for contrast/CVD on the dark surface.

## Sleep score

`lib/sleepScore.ts` computes a 0–100 composite over the 14-day window: sleep debt 35%,
duration-vs-need 30%, bedtime consistency 20%, self-rated energy 15%. Components with
no data drop out and weights renormalize. Shown on the dashboard as a semicircle gauge
— red (<50 "Needs work"), yellow (50–74 "Fair"), green (≥75 "Good") — always paired
with the text label, never color alone.

## AI coach

The dashboard Coach card answers questions grounded in your numbers (debt, score,
melatonin window) and today's journal entry, via the **Gemini API**:

1. Get a free API key at [aistudio.google.com](https://aistudio.google.com) (free tier,
   no card; pay-as-you-go beyond it).
2. Locally: add `GEMINI_API_KEY=...` to `.env.local`. On Vercel: Project → Settings →
   Environment Variables → add `GEMINI_API_KEY`, then redeploy.
3. Optional: `GEMINI_MODEL` overrides the default `gemini-2.5-flash`.

Without a key the coach still works — it answers from the rule-based engine in
`lib/recommendations.ts` and says so. The key stays server-side (`app/api/coach/route.ts`);
it is never shipped to the browser.

## Premium (Stripe)

Premium unlocks the conversational AI coach, theme color presets, and Oura
auto-sync. Billing state lives in `billing_customers`, which has **no user
write policies** — only the Stripe webhook (service role) can write it, so
premium can't be self-granted through the public API.

Setup:
1. In [Stripe](https://dashboard.stripe.com): create a Product with a recurring
   Price; copy the price id (`price_…`).
2. Developers → Webhooks → Add endpoint: `https://<your-app>/api/stripe/webhook`
   with events `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`; copy the signing secret (`whsec_…`).
3. Env vars (locally in `.env.local` and on Vercel → Settings → Environment
   Variables, then redeploy):

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe API key (`sk_…`) |
| `STRIPE_PRICE_ID` | The subscription price (`price_…`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (dashboard → API) — webhook only |
| `NEXT_PUBLIC_APP_URL` | Your deployed URL, for checkout redirects |
| `GEMINI_API_KEY` | AI coach (premium answers) |

4. Run `supabase/migrations/003_premium.sql` in the Supabase SQL editor.
5. Test with Stripe test mode + card `4242 4242 4242 4242`. For local webhook
   testing use `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Oura auto-sync (Premium)

On `/import`, paste a personal access token from
cloud.ouraring.com → Personal Access Tokens; the app pulls the last 30 days of
sleep from the Oura v2 API and inserts them with the same dedupe as file
imports (re-syncing is idempotent).

## Mobile app (Expo)

`mobile/` is a React Native companion app — same Supabase login, calls this
app's REST API with bearer tokens. See [mobile/README.md](mobile/README.md)
for setup and the HealthKit roadmap.

## Journal

**/notes** stores one row per user per day (`daily_notes`): Activities, Meals, Goals,
Notes — structured so future insights can correlate habits (late caffeine, workouts)
with sleep. Requires `supabase/migrations/002_daily_notes.sql` if your project predates it.

## Security model

- **Authentication**: Supabase email/password; session lives in httpOnly-managed cookies
  (`@supabase/ssr`).
- **Authorization**: RLS policies in `supabase/schema.sql`. UI hiding and proxy redirects
  are conveniences — the database enforces ownership.
- **Validation**: three layers — client checks (UX), zod in route handlers (the gate),
  CHECK constraints in Postgres (backstop).
- The contact table allows public INSERT but has **no SELECT policy**, so submissions
  cannot be scraped through the public API.

## Roadmap (deliberately not in v1)

- **Wearable ingest** (Apple Health, Fitbit, Oura): needs a mobile companion app —
  HealthKit data is only readable on-device. Plan: Expo/React Native app that reads
  HealthKit/Google Fit and POSTs to `/api/sleep-logs` with a bearer token.
- **AI coach**: layer the Claude API over `lib/recommendations.ts` to phrase the
  rule-based output conversationally; keep the rules as guardrails.
- **Stripe** subscriptions for premium features; **PostHog** for product analytics.
- Smart alarms, calendar integration, widgets, habit reminder pushes.
- Unit tests for `lib/sleepDebt.ts` (pure functions — trivially testable).
- Rate-limit `/api/contact` before public deploy.

> Habits: Sleep Quality is an educational tool, not medical advice.

## Theming

Light (default) and dark themes live entirely in `styles/globals.css` as CSS custom
properties (`:root` = light, `[data-theme="dark"]` = dark), following a warm
cream/white/orange palette. The nav toggle persists the choice to localStorage and an
inline script in `app/layout.tsx` applies it before first paint. Chart and status
colors (`--chart-line`, `--good`, `--warn`, `--danger`) are contrast/CVD-validated
per theme — re-validate if you change them.

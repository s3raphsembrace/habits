# Somnia — sleep debt & energy tracker

Somnia calculates your **sleep debt** (rolling 14-day ledger of sleep owed vs. slept),
estimates your **melatonin window** from your habitual bedtime, tracks self-reported
**energy**, and turns the numbers into concrete recommendations. It also ships a
dependency-free brown-noise generator for winding down and a sleep science library.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 12.3 (pages router) + React 18 + TypeScript | Next 12 is the newest Next that runs on this machine's Node 16.8; see "Upgrading" |
| Backend | Next.js API routes (REST) | `/api/sleep-logs`, `/api/insights`, `/api/contact` |
| Database + Auth | Supabase (Postgres + JWT auth) | Row Level Security is the real authorization layer |
| Validation | zod (server) + HTML/JS checks (client) | Client checks are UX; zod + DB constraints are the gate |
| Styling | Single global CSS file, mobile-first | No CSS framework needed at this size |

## Getting started

1. `npm install`
2. Create a free project at [supabase.com](https://supabase.com), then run
   `supabase/schema.sql` in the SQL Editor (dashboard → SQL Editor → paste → Run).
3. Copy `.env.local.example` to `.env.local` and fill in your project URL and anon key
   (dashboard → Project Settings → API).
4. `npm run dev` → http://localhost:3000
5. (Optional, for quick local testing) In Supabase → Authentication → Providers → Email,
   disable "Confirm email" so sign-ups work instantly without an email loop.

## Architecture in one paragraph

The browser talks to Next.js API routes with the user's Supabase JWT in an
`Authorization: Bearer` header. Each API route rebuilds a Supabase client that forwards
that token, so **Postgres Row Level Security evaluates every query as the user** —
even a buggy handler cannot read or write another user's rows. Sleep math lives in
`lib/sleepDebt.ts` as pure functions (no I/O), and `lib/recommendations.ts` maps the
resulting numbers to advice via explicit thresholds.

## Security model

- **Authentication**: Supabase email/password. Sessions are JWTs managed by
  `@supabase/supabase-js` in the browser.
- **Authorization**: RLS policies in `supabase/schema.sql`. UI hiding (nav links,
  redirects) is convenience only — the database enforces ownership.
- **Validation**: three layers — HTML/client checks (UX), zod schemas in API routes
  (the real gate), and CHECK constraints in Postgres (backstop).
- The contact table allows public INSERT but has **no SELECT policy**, so submissions
  cannot be scraped through the public API.

## Upgrading (recommended)

This machine runs Node 16.8, which caps us at Next 12. After installing Node 20 LTS:

1. Bump `next` to `^14`, migrate `pages/` to `app/` (or keep pages — still supported).
2. Replace the `<Link><a>` pattern with plain `<Link>` children.
3. Swap manual bearer-token forwarding for `@supabase/ssr` cookie-based auth.

## Roadmap (deliberately not in v1)

- **Wearable ingest** (Apple Health, Fitbit, Oura): needs a mobile companion app —
  HealthKit data is only readable on-device. Plan: Expo/React Native app that reads
  HealthKit/Google Fit and POSTs to `/api/sleep-logs`.
- **AI coach**: layer the Claude API over `lib/recommendations.ts` to phrase the
  rule-based output conversationally; keep the rules as guardrails.
- **Stripe** subscriptions for premium features; **PostHog** for product analytics.
- Smart alarms, calendar integration, widgets, habit reminder pushes.
- Unit tests for `lib/sleepDebt.ts` (pure functions — trivially testable).

> Somnia is an educational tool, not medical advice.

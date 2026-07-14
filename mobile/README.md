# Habits: Sleep Quality — mobile companion (Expo)

A React Native app that signs into the same Supabase project and talks to the
web app's REST API with a bearer token (the API has supported bearer auth since
day one, specifically for this app). Dashboard (score, debt, melatonin window,
recommendations) + quick sleep logging.

## Run it

1. `cd mobile && npm install`
2. Fill in `config.ts`:
   - `SUPABASE_URL` / `SUPABASE_ANON_KEY` — same values as the web `.env.local`
   - `API_BASE` — your Vercel URL, or `http://<your-LAN-IP>:3000` against a local
     `npm run dev` (not `localhost` — that would be the phone itself)
3. `npx expo start`, then scan the QR code with the **Expo Go** app
   (App Store / Play Store).

## Roadmap: HealthKit / Google Fit auto-detection

Reading sleep from Apple Health or screen-activity signals requires native
modules (`react-native-health` / Health Connect) that don't run inside Expo Go —
they need an EAS development build (`npx eas build --profile development`).
The ingestion path is already live: read HealthKit samples on-device and POST
them to `/api/sleep-logs/import` (same dedupe as file imports). This scaffold
keeps everything Expo Go-compatible so you can run it today without builds.

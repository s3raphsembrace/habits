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

## Automatic free deployment (EAS Update)

Every push to `main` that touches `mobile/` publishes an over-the-air JS update
to Expo's CDN via `.github/workflows/eas-update.yml`. Anyone running the app in
**Expo Go** (or a dev/preview build) gets the new version on next launch — no
rebuild, no store review, no cost. This is the free, automatic path.

One-time setup:

1. Create a free account at [expo.dev](https://expo.dev), then `npm i -g eas-cli`
   and `eas login`.
2. From `mobile/`, run `eas init` (creates the EAS project, writes the
   `projectId` into `app.json`) then `eas update:configure` (adds the update URL
   + `runtimeVersion` and installs `expo-updates`).
3. Create an **access token** at expo.dev → Account settings → Access tokens.
4. In GitHub → repo **Settings → Secrets and variables → Actions → New
   repository secret**, add `EXPO_TOKEN` = that token.
5. Commit the `app.json` changes from step 2 and push. The workflow runs; watch
   it under the repo's **Actions** tab.
6. Give testers the QR code / project link from expo.dev; they open it in Expo
   Go and always get the latest published update.

### What "free" does and doesn't cover

- **Free & automatic:** OTA JS updates to Expo Go / existing dev builds (this
  workflow). EAS Update's free tier covers a typical personal/beta project.
- **Free but limited/manual:** `eas build --profile preview` produces an
  installable Android **APK** you can sideload (free tier = a limited number of
  builds/month on a shared queue). Good for putting a real app on your own phone
  without a store.
- **Not free:** publishing to the Apple App Store ($99/yr) or Google Play
  ($25 one-time). The store listing is the only paid part; the build pipeline
  itself has a free tier.

## Roadmap: HealthKit / Google Fit auto-detection

Reading sleep from Apple Health or screen-activity signals requires native
modules (`react-native-health` / Health Connect) that don't run inside Expo Go —
they need an EAS development build (`npx eas build --profile development`).
The ingestion path is already live: read HealthKit samples on-device and POST
them to `/api/sleep-logs/import` (same dedupe as file imports). This scaffold
keeps everything Expo Go-compatible so you can run it today without builds.

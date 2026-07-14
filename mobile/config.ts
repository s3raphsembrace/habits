/**
 * Fill these in before running the app.
 * - SUPABASE_URL / SUPABASE_ANON_KEY: same values as the web app's .env.local
 *   (Supabase dashboard -> Project Settings -> API). The anon key is safe to
 *   embed; Row Level Security protects the data.
 * - API_BASE: your deployed web app (the mobile app calls its REST API with
 *   a bearer token). For local testing use your machine's LAN IP, e.g.
 *   "http://192.168.1.20:3000" — NOT localhost (that's the phone itself).
 */
export const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
export const API_BASE = "https://your-app.vercel.app";

-- Somnia database schema. Run this in the Supabase SQL editor
-- (dashboard -> SQL Editor -> New query -> paste -> Run).

-- ---------------------------------------------------------------------------
-- Sleep logs: one row per night (or nap)
-- ---------------------------------------------------------------------------
create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sleep_start timestamptz not null,
  sleep_end timestamptz not null,
  energy_rating int check (energy_rating between 1 and 5),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  constraint sleep_end_after_start check (sleep_end > sleep_start)
);

create index if not exists sleep_logs_user_end_idx
  on public.sleep_logs (user_id, sleep_end desc);

-- Row Level Security: users can only touch their own rows. This is the real
-- authorization layer — API handlers and UI checks are conveniences on top.
alter table public.sleep_logs enable row level security;

create policy "read own logs" on public.sleep_logs
  for select using (auth.uid() = user_id);

create policy "insert own logs" on public.sleep_logs
  for insert with check (auth.uid() = user_id);

create policy "update own logs" on public.sleep_logs
  for update using (auth.uid() = user_id);

create policy "delete own logs" on public.sleep_logs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Profiles: per-user settings (sleep need)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sleep_need_hours numeric(3,1) not null default 8.0
    check (sleep_need_hours between 4 and 12),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "read own profile" on public.profiles
  for select using (auth.uid() = user_id);

create policy "upsert own profile" on public.profiles
  for insert with check (auth.uid() = user_id);

create policy "update own profile" on public.profiles
  for update using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Contact messages: anyone (including logged-out visitors) may submit;
-- nobody may read them through the public API (only the service role /
-- dashboard can), so the contact inbox can't be scraped.
-- ---------------------------------------------------------------------------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 200),
  message text not null check (char_length(message) between 10 and 2000),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

create policy "anyone can submit contact" on public.contact_messages
  for insert with check (true);
-- Note: no SELECT policy on purpose — inserts are write-only for the public.

-- ---------------------------------------------------------------------------
-- Daily journal: one row per user per day (activities, meals, goals, notes)
-- ---------------------------------------------------------------------------
create table if not exists public.daily_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note_date date not null,
  activities text not null default '' check (char_length(activities) <= 2000),
  meals text not null default '' check (char_length(meals) <= 2000),
  goals text not null default '' check (char_length(goals) <= 2000),
  notes text not null default '' check (char_length(notes) <= 2000),
  updated_at timestamptz not null default now(),
  unique (user_id, note_date)
);

alter table public.daily_notes enable row level security;

create policy "read own notes" on public.daily_notes
  for select using (auth.uid() = user_id);

create policy "insert own notes" on public.daily_notes
  for insert with check (auth.uid() = user_id);

create policy "update own notes" on public.daily_notes
  for update using (auth.uid() = user_id);

create policy "delete own notes" on public.daily_notes
  for delete using (auth.uid() = user_id);

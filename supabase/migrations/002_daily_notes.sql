-- Migration 002: daily journal notes.
-- Run ONLY this file in the Supabase SQL editor if you already ran schema.sql
-- (re-running schema.sql would fail on duplicate policies).

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

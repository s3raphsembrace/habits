-- Migration 003: Stripe billing + premium features (theme presets, Oura).
-- Run ONLY this file if you already ran the earlier schema/migrations.

-- Billing state. SECURITY: there are deliberately NO insert/update policies
-- for authenticated users — only the service role (the Stripe webhook) can
-- write, so users cannot grant themselves premium through the public API.
create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  is_premium boolean not null default false,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.billing_customers enable row level security;

create policy "read own billing" on public.billing_customers
  for select using (auth.uid() = user_id);

-- Premium personalization + integrations (user-writable via existing
-- profiles policies; premium enforcement happens server-side).
alter table public.profiles add column if not exists theme_preset text not null default 'cream'
  check (theme_preset in ('cream', 'lavender', 'mint', 'sky', 'rose'));
alter table public.profiles add column if not exists oura_token text;

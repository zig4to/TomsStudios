-- TomStudios — osebna postavitev kartic na nadzorni plošči, ena vrstica na
-- mesto (prazno "+" ali dodeljena aplikacija). Zaženi enkrat v Supabase SQL
-- editorju, po 001_allowed_emails.sql.

create extension if not exists pgcrypto; -- za gen_random_uuid()

create table if not exists public.user_dashboard_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text,                     -- null = prazno "+" mesto; ujema se z id v apps-registry.js
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- deferrable: pri zamenjavi dveh pozicij v enem večvrstičnem upsert-u (glej
  -- dashboard.js saveOrder()) se preverjanje unikatnosti odloži do konca
  -- stavka, sicer bi vmesno stanje (dve vrstici z isto pozicijo) povzročilo
  -- napako, čeprav je končni rezultat veljaven.
  constraint uq_user_position unique (user_id, position) deferrable initially deferred
);

create index if not exists idx_user_dashboard_slots_user
  on public.user_dashboard_slots (user_id, position);

alter table public.user_dashboard_slots enable row level security;

create policy "select own slots" on public.user_dashboard_slots
  for select using (auth.uid() = user_id);

create policy "insert own slots" on public.user_dashboard_slots
  for insert with check (auth.uid() = user_id);

create policy "update own slots" on public.user_dashboard_slots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete own slots" on public.user_dashboard_slots
  for delete using (auth.uid() = user_id);

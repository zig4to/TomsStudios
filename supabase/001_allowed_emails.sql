-- TomStudios — seznam e-poštnih naslovov, ki smejo dokončati registracijo.
-- Zaženi enkrat v Supabase nadzorni plošči: SQL Editor → New query → Run.

create table if not exists public.allowed_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;
-- Namerno brez politik: z vklopljenim RLS in brez ene same politike anon in
-- authenticated vlogi ne moreta niti brati niti pisati te tabele prek API-ja.
-- Urejaš jo izključno prek Supabase SQL editorja, npr.:
--   insert into public.allowed_emails (email) values ('ime@example.com');

-- Zaščitna funkcija: preveri se PRED vstavitvijo v auth.users. Če e-pošta ni
-- na seznamu, se vstavitev zavrne — registracija ne uspe in (če je potrditev
-- e-pošte vklopljena) se potrditveno sporočilo sploh ne pošlje.
create or replace function public.check_allowed_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(new.email)
  ) then
    raise exception 'signup_not_allowed: % is not on the invite list', new.email
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_allowed_email on auth.users;
create trigger trg_check_allowed_email
  before insert on auth.users
  for each row
  execute function public.check_allowed_email();

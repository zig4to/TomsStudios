-- TomStudios — administracija: pravice do aplikacij, blokiranje, admini.
-- Zaženi enkrat v Supabase nadzorni plošči: SQL Editor → New query → Run.
-- Predpogoj: 001–004.
--
-- Pravila:
-- - admin ima dostop do vseh aplikacij in do admin plošče v hubu;
-- - ostali imajo dostop samo do aplikacij v app_access; nov uporabnik dobi
--   samodejno "mascajt" (Dogodki), ostalo mu dodeli admin;
-- - blokiran uporabnik nima dostopa do ničesar (tudi če je admin).
-- Tabele so brez politik RLS: berejo/pišejo se samo prek spodnjih funkcij,
-- ki same preverijo, ali je klicatelj admin.

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.app_access (
  user_id uuid not null references auth.users (id) on delete cascade,
  app_id text not null,                 -- ujema se z id v apps-registry.js
  granted_at timestamptz not null default now(),
  primary key (user_id, app_id)
);
create table if not exists public.blocked_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  blocked_at timestamptz not null default now()
);
alter table public.admins enable row level security;
alter table public.app_access enable row level security;
alter table public.blocked_users enable row level security;

-- ---------------------------------------------------------------------------
-- Preverjanje dostopa (kliče jih hub, aplikacije in politike RLS)

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
     and not exists (select 1 from blocked_users where user_id = auth.uid());
$$;

create or replace function public.has_app_access(p_app text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and not exists (select 1 from blocked_users where user_id = auth.uid())
     and (exists (select 1 from admins where user_id = auth.uid())
          or exists (select 1 from app_access where user_id = auth.uid() and app_id = p_app));
$$;

-- Vse za hub v enem klicu: { is_admin, blocked, apps: [...] }.
create or replace function public.my_access()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'is_admin', exists (select 1 from admins where user_id = auth.uid()),
    'blocked', exists (select 1 from blocked_users where user_id = auth.uid()),
    'apps', coalesce((select json_agg(app_id order by app_id) from app_access where user_id = auth.uid()), '[]'::json)
  );
$$;

-- Nov uporabnik: privzeto dobi Dogodke.
create or replace function public.grant_default_apps()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into app_access (user_id, app_id) values (new.id, 'mascajt') on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists trg_grant_default_apps on auth.users;
create trigger trg_grant_default_apps
  after insert on auth.users
  for each row execute function public.grant_default_apps();

-- ---------------------------------------------------------------------------
-- Admin funkcije (vsaka najprej preveri, da je klicatelj admin)

create or replace function public.assert_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_list_users()
returns table (
  id uuid, email text, first_name text, last_name text,
  created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean,
  is_admin boolean, blocked boolean, apps text[]
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.assert_admin();
  return query
  select u.id,
         u.email::text,
         coalesce(u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'given_name', '')::text,
         coalesce(u.raw_user_meta_data->>'last_name', u.raw_user_meta_data->>'family_name', '')::text,
         u.created_at,
         u.last_sign_in_at,
         (u.email_confirmed_at is not null),
         exists (select 1 from admins a where a.user_id = u.id),
         exists (select 1 from blocked_users b where b.user_id = u.id),
         coalesce((select array_agg(x.app_id order by x.app_id) from app_access x where x.user_id = u.id), '{}')
    from auth.users u
   order by u.created_at;
end;
$$;

create or replace function public.admin_set_app_access(p_user uuid, p_app text, p_allowed boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  if p_allowed then
    insert into app_access (user_id, app_id) values (p_user, p_app) on conflict do nothing;
  else
    delete from app_access where user_id = p_user and app_id = p_app;
  end if;
end;
$$;

create or replace function public.admin_set_blocked(p_user uuid, p_blocked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  if p_user = auth.uid() then
    raise exception 'cannot_block_self';
  end if;
  if p_blocked then
    insert into blocked_users (user_id) values (p_user) on conflict do nothing;
  else
    delete from blocked_users where user_id = p_user;
  end if;
end;
$$;

create or replace function public.admin_set_admin(p_user uuid, p_admin boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  -- Sebi ne more odvzeti admina — tako vedno ostane vsaj en admin.
  if p_user = auth.uid() and not p_admin then
    raise exception 'cannot_unadmin_self';
  end if;
  if p_admin then
    insert into admins (user_id) values (p_user) on conflict do nothing;
  else
    delete from admins where user_id = p_user;
  end if;
end;
$$;

create or replace function public.admin_set_password(p_user uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.assert_admin();
  if p_password is null or length(p_password) < 6 then
    raise exception 'password_too_short';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user;
end;
$$;

create or replace function public.admin_set_name(p_user uuid, p_first text, p_last text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update auth.users
     set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
           || jsonb_build_object('first_name', trim(p_first), 'last_name', trim(p_last)),
         updated_at = now()
   where id = p_user;
end;
$$;

create or replace function public.admin_new_invite(p_note text)
returns text language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return public.new_invite(p_note);
end;
$$;

create or replace function public.admin_list_invites()
returns table (code text, note text, created_at timestamptz, used_at timestamptz, used_by text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.assert_admin();
  return query
  select i.code, i.note, i.created_at, i.used_at, i.used_by
    from invite_codes i
   order by i.created_at desc;
end;
$$;

create or replace function public.admin_delete_invite(p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  delete from invite_codes where code = p_code and used_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pravice za klic prek API-ja. Supabase privzeto da EXECUTE vsem — zato
-- najprej odvzamemo, nato dodelimo le tisto, kar je potrebno.

revoke all on function public.is_admin() from public, anon;
revoke all on function public.my_access() from public, anon;
revoke all on function public.assert_admin() from public, anon, authenticated;
revoke all on function public.grant_default_apps() from public, anon, authenticated;
revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_set_app_access(uuid, text, boolean) from public, anon;
revoke all on function public.admin_set_blocked(uuid, boolean) from public, anon;
revoke all on function public.admin_set_admin(uuid, boolean) from public, anon;
revoke all on function public.admin_set_password(uuid, text) from public, anon;
revoke all on function public.admin_set_name(uuid, text, text) from public, anon;
revoke all on function public.admin_new_invite(text) from public, anon;
revoke all on function public.admin_list_invites() from public, anon;
revoke all on function public.admin_delete_invite(text) from public, anon;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_access() to authenticated;
-- has_app_access tudi anon: kličejo jo politike RLS, ki veljajo za vse vloge
-- (za anon vrne false, ker ni auth.uid()).
grant execute on function public.has_app_access(text) to anon, authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_app_access(uuid, text, boolean) to authenticated;
grant execute on function public.admin_set_blocked(uuid, boolean) to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
grant execute on function public.admin_set_name(uuid, text, text) to authenticated;
grant execute on function public.admin_new_invite(text) to authenticated;
grant execute on function public.admin_list_invites() to authenticated;
grant execute on function public.admin_delete_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Začetno stanje

-- Obstoječi uporabniki ne izgubijo ničesar: dobijo Dogodke in vse aplikacije,
-- ki jih že imajo na svoji plošči.
insert into public.app_access (user_id, app_id)
select u.id, 'mascajt' from auth.users u
on conflict do nothing;
insert into public.app_access (user_id, app_id)
select distinct s.user_id, s.app_id from public.user_dashboard_slots s where s.app_id is not null
on conflict do nothing;

-- Prvi admin (po e-pošti računa). Preveri, da je spodnji select vrnil vrstico.
insert into public.admins (user_id)
select id from auth.users where lower(email) = lower('ziga.skater@gmail.com')
on conflict do nothing;
select u.email as admin from public.admins a join auth.users u on u.id = a.user_id;

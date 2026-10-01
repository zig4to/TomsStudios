-- TomStudios — registracija z enkratno kodo vabila v povezavi.
-- Zaženi enkrat v Supabase nadzorni plošči: SQL Editor → New query → Run.
--
-- Kdor odpre povezavo ?vabilo=<koda> (hub ali Dogodki), pošlje kodo ob
-- registraciji v user_metadata.invite. Registracija uspe, če je e-pošta na
-- seznamu allowed_emails ALI če je koda veljavna in še neporabljena. Koda se
-- ob tem porabi (used_at/used_by), zato vsaka povezava deluje za eno samo
-- registracijo in je posredovanje naprej ne pomnoži.
--
-- Nova povezava (ime je samo zate, da veš, komu si jo poslal):
--   select public.new_invite('Jernej');
-- Pregled:
--   select * from public.invite_codes order by created_at desc;
-- Preklic še neporabljene:
--   delete from public.invite_codes where code = '<koda>';

create table if not exists public.invite_codes (
  code text primary key,
  note text,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by text
);
alter table public.invite_codes add column if not exists used_at timestamptz;
alter table public.invite_codes add column if not exists used_by text;

alter table public.invite_codes enable row level security;
-- Namerno brez politik (kot allowed_emails): kod ni mogoče brati ne ustvarjati
-- prek API-ja, samo v SQL editorju — vabila torej pošiljaš samo ti.

create or replace function public.check_allowed_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(new.email)
  ) then
    return new;
  end if;
  -- Porabi kodo v istem koraku, kot jo preveri: dve hkratni registraciji z
  -- isto kodo ne moreta obe uspeti (druga čaka na zaklep vrstice in nato
  -- ne najde več neporabljene). Če vstavitev uporabnika kasneje vseeno
  -- spodleti, se transakcija razveljavi in koda ostane neporabljena.
  update public.invite_codes
     set used_at = now(), used_by = new.email
   where code = new.raw_user_meta_data->>'invite'
     and used_at is null;
  if found then
    return new;
  end if;
  raise exception 'signup_not_allowed: % is not on the invite list', new.email
    using errcode = '42501';
end;
$$;

-- Ustvari kodo in vrne celotno povezavo za pošiljanje.
create or replace function public.new_invite(p_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
begin
  insert into public.invite_codes (code, note) values (v_code, p_note);
  return 'https://zig4to.github.io/TomsStudios/?vabilo=' || v_code;
end;
$$;
-- Samo za SQL editor: anon/authenticated je ne smeta klicati prek API-ja
-- (/rest/v1/rpc/new_invite), sicer bi si vabila delil kdorkoli.
revoke all on function public.new_invite(text) from public, anon, authenticated;

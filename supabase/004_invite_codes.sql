-- TomStudios — registracija s kodo vabila v povezavi.
-- Zaženi enkrat v Supabase nadzorni plošči: SQL Editor → New query → Run.
--
-- Kdor odpre povezavo ?vabilo=<koda> (hub ali Dogodki), pošlje kodo ob
-- registraciji v user_metadata.invite. Registracija uspe, če je e-pošta na
-- seznamu allowed_emails ALI če je koda veljavna. Brez enega ali drugega se
-- vstavitev v auth.users zavrne kot doslej.

create table if not exists public.invite_codes (
  code text primary key,
  note text,
  created_at timestamptz not null default now()
);

alter table public.invite_codes enable row level security;
-- Namerno brez politik (kot allowed_emails): kod ni mogoče prebrati prek
-- API-ja, urejaš jih samo v SQL editorju. Prave kode NE piši v ta repozitorij
-- — je javen. Nova koda / zamenjava (stare povezave nehajo delovati):
--   insert into public.invite_codes (code, note) values ('<koda>', 'Garaža Klub');
--   delete from public.invite_codes where code = '<stara koda>';

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
  if exists (
    select 1 from public.invite_codes
    where code = new.raw_user_meta_data->>'invite'
  ) then
    return new;
  end if;
  raise exception 'signup_not_allowed: % is not on the invite list', new.email
    using errcode = '42501';
end;
$$;

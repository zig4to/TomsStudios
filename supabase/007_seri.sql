-- Šeri: pošiljanje datotek med uporabniki huba (do 50 MB, hramba 24 ur).
-- Datoteka gre v zasebni bucket `seri` pod <sender_id>/<uuid>; vrstica v
-- seri_transfers jo „pošlje“ prejemniku (Realtime). Izvirno ime je v tabeli,
-- ne v ključu (šumniki/presledki v ključih Storage niso dovoljeni).

-- 1) Seznam uporabnikov huba za izbiro prejemnika (brez e-pošt, brez blokiranih).
create or replace function public.seri_users()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id,
         coalesce(
           nullif(trim(concat_ws(' ', u.raw_user_meta_data ->> 'first_name', u.raw_user_meta_data ->> 'last_name')), ''),
           split_part(u.email, '@', 1)
         ) as name
  from auth.users u
  where auth.uid() is not null
    and not exists (select 1 from public.blocked_users b where b.user_id = u.id)
  order by 2;
$$;
revoke all on function public.seri_users() from public, anon;
grant execute on function public.seri_users() to authenticated;

-- 2) Prenosi
create table if not exists public.seri_transfers (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  path text not null unique check (char_length(path) <= 200),
  name text not null check (char_length(name) between 1 and 255),
  size bigint not null check (size >= 0 and size <= 52428800),
  mime text check (char_length(mime) <= 255),
  created_at timestamptz not null default now(),
  downloaded_at timestamptz,
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists seri_transfers_recipient_idx on public.seri_transfers (recipient_id, created_at desc);
create index if not exists seri_transfers_sender_idx on public.seri_transfers (sender_id, created_at desc);

alter table public.seri_transfers enable row level security;

-- Vidne tudi potekle (odjemalec jih filtrira in pobriše — DELETE z WHERE
-- zahteva vidnost prek SELECT politike). Prenos datoteke po poteku zaklene
-- politika na storage.objects spodaj.
create policy "seri_transfers_select" on public.seri_transfers
  for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create policy "seri_transfers_insert" on public.seri_transfers
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and split_part(path, '/', 1) = (select auth.uid())::text
    and expires_at <= now() + interval '24 hours 5 minutes'
    and not exists (select 1 from public.blocked_users b where b.user_id in (sender_id, recipient_id))
  );

-- Prejemnik lahko spremeni samo downloaded_at (glej grant spodaj).
create policy "seri_transfers_update" on public.seri_transfers
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- Brisanje: pošiljatelj ali prejemnik, tudi po poteku (leno čiščenje).
create policy "seri_transfers_delete" on public.seri_transfers
  for delete to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

revoke update on public.seri_transfers from authenticated;
grant update (downloaded_at) on public.seri_transfers to authenticated;

alter publication supabase_realtime add table public.seri_transfers;

-- 3) Bucket (zaseben, 50 MB, vsi formati)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('seri', 'seri', false, 52428800, null)
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = null;

create policy "seri_objects_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'seri' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "seri_objects_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'seri'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.seri_transfers t
        where t.path = storage.objects.name and t.recipient_id = (select auth.uid())
          and t.expires_at > now()
      )
    )
  );

create policy "seri_objects_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'seri'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.seri_transfers t
        where t.path = storage.objects.name and t.recipient_id = (select auth.uid())
      )
    )
  );

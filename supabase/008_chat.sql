-- Klepet: ena skupna soba za vse uporabnike huba.
-- Sporočila ostanejo za vedno; priložene datoteke (bucket `chat`, do 50 MB)
-- so dostopne 30 dni (prostor na brezplačnem paketu je 1 GB), nato jih
-- pošiljatelj leno pobriše ob odprtju klepeta.

-- 0) Ali je trenutni uporabnik blokiran? blocked_users ima RLS brez politik,
--    zato ga politike kot navaden uporabnik ne vidijo — potreben je definer.
create or replace function public.hub_is_blocked(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.blocked_users b where b.user_id = p_user);
$$;
revoke all on function public.hub_is_blocked(uuid) from public, anon;
grant execute on function public.hub_is_blocked(uuid) to authenticated;

-- Popravek 007: preverjanje blokade pri Šeriju prek definer funkcije.
drop policy if exists "seri_transfers_insert" on public.seri_transfers;
create policy "seri_transfers_insert" on public.seri_transfers
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and split_part(path, '/', 1) = (select auth.uid())::text
    and expires_at <= now() + interval '24 hours 5 minutes'
    and not public.hub_is_blocked(sender_id)
    and not public.hub_is_blocked(recipient_id)
  );

-- 1) Sporočila
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text check (char_length(body) <= 4000),
  file_path text unique check (char_length(file_path) <= 200),
  file_name text check (char_length(file_name) between 1 and 255),
  file_size bigint check (file_size >= 0 and file_size <= 52428800),
  file_mime text check (char_length(file_mime) <= 255),
  created_at timestamptz not null default now(),
  constraint chat_messages_has_content check (
    (body is not null and char_length(trim(body)) > 0)
    or (file_path is not null and file_name is not null)
  )
);
create index if not exists chat_messages_created_idx on public.chat_messages (created_at desc);
create index if not exists chat_messages_sender_idx on public.chat_messages (sender_id);

alter table public.chat_messages enable row level security;

create policy "chat_messages_select" on public.chat_messages
  for select to authenticated
  using (not public.hub_is_blocked());

create policy "chat_messages_insert" on public.chat_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and not public.hub_is_blocked()
    and (file_path is null or split_part(file_path, '/', 1) = (select auth.uid())::text)
  );

create policy "chat_messages_delete" on public.chat_messages
  for delete to authenticated
  using (sender_id = (select auth.uid()));

-- 2) Odzivi
create table if not exists public.chat_reactions (
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🔥')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists chat_reactions_user_idx on public.chat_reactions (user_id);
alter table public.chat_reactions replica identity full; -- DELETE v Realtime nosi message_id/emoji

alter table public.chat_reactions enable row level security;

create policy "chat_reactions_select" on public.chat_reactions
  for select to authenticated
  using (not public.hub_is_blocked());

create policy "chat_reactions_insert" on public.chat_reactions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and not public.hub_is_blocked());

create policy "chat_reactions_delete" on public.chat_reactions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- 3) Prebrano (za značko neprebranih na plošči)
create table if not exists public.chat_reads (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now()
);
alter table public.chat_reads enable row level security;

create policy "chat_reads_select" on public.chat_reads
  for select to authenticated using (user_id = (select auth.uid()));
create policy "chat_reads_insert" on public.chat_reads
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "chat_reads_update" on public.chat_reads
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.chat_reactions;

-- 4) Bucket za priponke (zaseben, 50 MB, vsi formati)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat', 'chat', false, 52428800, null)
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = null;

create policy "chat_objects_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not public.hub_is_blocked()
  );

-- branje: vsi neblokirani, 30 dni od objave sporočila
create policy "chat_objects_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat'
    and not public.hub_is_blocked()
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.chat_messages m
        where m.file_path = storage.objects.name
          and m.created_at > now() - interval '30 days'
      )
    )
  );

create policy "chat_objects_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Igre za 2 igralca (prva: Štiri v vrsto). Izziv se pošlje v klepet kot kartica,
-- igra teče na igra.html v živo (Realtime na game_matches).
-- Vse spremembe gredo prek security definer funkcij, ki preverijo pravila
-- (čigava je poteza, rok za potezo, zmaga) — odjemalec ne more goljufati.
-- Rok za potezo: 8 s (+2 s tolerance za omrežje). Kdor zamudi, izgubi.
-- Izziv je treba sprejeti v 5 minutah.

-- 1) Tekme
create table if not exists public.game_matches (
  id uuid primary key default gen_random_uuid(),
  game text not null default 'connect4' check (game in ('connect4')),
  player_a uuid not null references auth.users (id) on delete cascade, -- izzivalec, žetoni '1'
  player_b uuid not null references auth.users (id) on delete cascade, -- izzvani, žetoni '2'
  status text not null default 'pending'
    check (status in ('pending', 'active', 'done', 'declined', 'cancelled')),
  board text not null default repeat('0', 42) check (char_length(board) = 42 and board ~ '^[012]+$'),
  turn uuid,
  first_player uuid,
  winner uuid,
  end_reason text check (end_reason in ('win', 'draw', 'timeout', 'resign')),
  win_cells int[],
  moves int not null default 0,
  last_idx int,
  move_seconds int not null default 8 check (move_seconds between 5 and 300),
  turn_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_matches_two_players check (player_a <> player_b)
);
create index if not exists game_matches_a_idx on public.game_matches (player_a, created_at desc);
create index if not exists game_matches_b_idx on public.game_matches (player_b, created_at desc);
create index if not exists game_matches_status_idx on public.game_matches (game, status);

alter table public.game_matches enable row level security;

-- branje: vsi neblokirani (kartice v klepetu in gledanje tekme); pisanje samo prek funkcij
create policy "game_matches_select" on public.game_matches
  for select to authenticated
  using (not public.hub_is_blocked());

alter publication supabase_realtime add table public.game_matches;

-- 2) Kartica izziva v klepetu
alter table public.chat_messages
  add column if not exists game_id uuid references public.game_matches (id) on delete cascade;
alter table public.chat_messages drop constraint if exists chat_messages_has_content;
alter table public.chat_messages add constraint chat_messages_has_content check (
  (body is not null and char_length(trim(body)) > 0)
  or (file_path is not null and file_name is not null)
  or game_id is not null
);

-- odjemalec ne sme sam vstavljati kartic iger (samo game_challenge)
drop policy if exists "chat_messages_insert" on public.chat_messages;
create policy "chat_messages_insert" on public.chat_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and not public.hub_is_blocked()
    and game_id is null
    and (file_path is null or split_part(file_path, '/', 1) = (select auth.uid())::text)
  );

-- 3) Pomožno
create or replace function public.game_json(p_match uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(g) || jsonb_build_object('server_now', now())
  from public.game_matches g
  where g.id = p_match and auth.uid() is not null and not public.hub_is_blocked();
$$;

-- zmagovalna vrsta skozi polje p_idx (vrstica 0 = zgoraj, indeks = vrstica*7 + stolpec)
create or replace function public.c4_win(p_board text, p_idx int)
returns int[]
language plpgsql
immutable
set search_path = public
as $$
declare
  r int := p_idx / 7;
  c int := p_idx % 7;
  ch text := substr(p_board, p_idx + 1, 1);
  dirs int[] := array[[0, 1], [1, 0], [1, 1], [1, -1]];
  d int; sg int; dr int; dc int; rr int; cc int;
  cells int[];
begin
  if ch = '0' then return null; end if;
  for d in 1..4 loop
    dr := dirs[d][1];
    dc := dirs[d][2];
    cells := array[p_idx];
    foreach sg in array array[1, -1] loop
      rr := r + dr * sg;
      cc := c + dc * sg;
      while rr between 0 and 5 and cc between 0 and 6 and substr(p_board, rr * 7 + cc + 1, 1) = ch loop
        cells := cells || (rr * 7 + cc);
        rr := rr + dr * sg;
        cc := cc + dc * sg;
      end loop;
    end loop;
    if array_length(cells, 1) >= 4 then return cells; end if;
  end loop;
  return null;
end;
$$;

-- 4) Izziv: tekma + kartica v klepetu
create or replace function public.game_challenge(p_opponent uuid, p_game text default 'connect4')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  mid uuid;
begin
  if me is null then raise exception 'Nisi prijavljen.'; end if;
  if p_opponent is null or p_opponent = me then raise exception 'Izberi nasprotnika.'; end if;
  if public.hub_is_blocked(me) or public.hub_is_blocked(p_opponent) then raise exception 'Ni dovoljeno.'; end if;
  if not exists (select 1 from auth.users u where u.id = p_opponent) then raise exception 'Uporabnik ne obstaja.'; end if;

  -- isti odprt izziv istemu nasprotniku → vrni obstoječega
  select id into mid from public.game_matches
  where player_a = me and player_b = p_opponent and game = p_game
    and status = 'pending' and created_at > now() - interval '5 minutes'
  limit 1;
  if mid is not null then return mid; end if;

  if (select count(*) from public.game_matches
      where player_a = me and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'Preveč izzivov naenkrat. Počakaj minuto.';
  end if;

  insert into public.game_matches (game, player_a, player_b)
  values (p_game, me, p_opponent)
  returning id into mid;

  insert into public.chat_messages (sender_id, game_id) values (me, mid);
  return mid;
end;
$$;

-- 5) Sprejmi / zavrni (izzvani), prekliči (izzivalec)
create or replace function public.game_respond(p_match uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.game_matches;
  first uuid;
begin
  select * into m from public.game_matches where id = p_match for update;
  if not found then raise exception 'Igra ne obstaja.'; end if;
  if m.player_b <> auth.uid() then raise exception 'Izziv ni zate.'; end if;
  if m.status <> 'pending' then raise exception 'Izziv ni več odprt.'; end if;
  if m.created_at < now() - interval '5 minutes' then raise exception 'Izziv je potekel.'; end if;

  if p_accept then
    first := case when random() < 0.5 then m.player_a else m.player_b end;
    update public.game_matches
      set status = 'active', first_player = first, turn = first,
          turn_deadline = now() + make_interval(secs => m.move_seconds), updated_at = now()
      where id = p_match;
  else
    update public.game_matches set status = 'declined', updated_at = now() where id = p_match;
  end if;
  return public.game_json(p_match);
end;
$$;

create or replace function public.game_cancel(p_match uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.game_matches set status = 'cancelled', updated_at = now()
  where id = p_match and player_a = auth.uid() and status = 'pending';
  if not found then raise exception 'Izziva ni mogoče preklicati.'; end if;
  return public.game_json(p_match);
end;
$$;

-- 6) Poteza
create or replace function public.game_move(p_match uuid, p_col int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  m public.game_matches;
  opp uuid;
  idx int := null;
  r int;
  mark text;
  b text;
  win int[];
begin
  select * into m from public.game_matches where id = p_match for update;
  if not found then raise exception 'Igra ne obstaja.'; end if;
  if m.status <> 'active' then raise exception 'Igra ni v teku.'; end if;
  if m.turn is distinct from me then raise exception 'Nisi na potezi.'; end if;
  opp := case when me = m.player_a then m.player_b else m.player_a end;

  if now() > m.turn_deadline + interval '2 seconds' then
    update public.game_matches
      set status = 'done', winner = opp, end_reason = 'timeout', turn_deadline = null, updated_at = now()
      where id = p_match;
    return public.game_json(p_match);
  end if;

  if p_col is null or p_col < 0 or p_col > 6 then raise exception 'Napačen stolpec.'; end if;
  for r in reverse 5..0 loop
    if substr(m.board, r * 7 + p_col + 1, 1) = '0' then
      idx := r * 7 + p_col;
      exit;
    end if;
  end loop;
  if idx is null then raise exception 'Stolpec je poln.'; end if;

  mark := case when me = m.player_a then '1' else '2' end;
  b := overlay(m.board placing mark from idx + 1 for 1);
  win := public.c4_win(b, idx);

  if win is not null then
    update public.game_matches
      set board = b, moves = m.moves + 1, last_idx = idx, status = 'done', winner = me,
          end_reason = 'win', win_cells = win, turn = null, turn_deadline = null, updated_at = now()
      where id = p_match;
  elsif m.moves + 1 >= 42 then
    update public.game_matches
      set board = b, moves = m.moves + 1, last_idx = idx, status = 'done', end_reason = 'draw',
          turn = null, turn_deadline = null, updated_at = now()
      where id = p_match;
  else
    update public.game_matches
      set board = b, moves = m.moves + 1, last_idx = idx, turn = opp,
          turn_deadline = now() + make_interval(secs => m.move_seconds), updated_at = now()
      where id = p_match;
  end if;
  return public.game_json(p_match);
end;
$$;

-- 7) Potekel čas (zahteva lahko kateri koli igralec) in predaja
create or replace function public.game_timeout(p_match uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.game_matches;
begin
  select * into m from public.game_matches where id = p_match for update;
  if not found then raise exception 'Igra ne obstaja.'; end if;
  if auth.uid() not in (m.player_a, m.player_b) then raise exception 'Nisi v tej igri.'; end if;
  if m.status = 'active' and now() > m.turn_deadline + interval '2 seconds' then
    update public.game_matches
      set status = 'done', end_reason = 'timeout', turn_deadline = null, updated_at = now(),
          winner = case when m.turn = m.player_a then m.player_b else m.player_a end
      where id = p_match;
  end if;
  return public.game_json(p_match);
end;
$$;

create or replace function public.game_resign(p_match uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  m public.game_matches;
begin
  select * into m from public.game_matches where id = p_match for update;
  if not found then raise exception 'Igra ne obstaja.'; end if;
  if me not in (m.player_a, m.player_b) then raise exception 'Nisi v tej igri.'; end if;
  if m.status <> 'active' then raise exception 'Igra ni v teku.'; end if;
  update public.game_matches
    set status = 'done', end_reason = 'resign', turn = null, turn_deadline = null, updated_at = now(),
        winner = case when me = m.player_a then m.player_b else m.player_a end
    where id = p_match;
  return public.game_json(p_match);
end;
$$;

-- 8) Lestvica (zapuščena tekma s potečenim rokom šteje kot poraz za tistega na potezi)
create or replace function public.game_leaderboard(p_game text default 'connect4')
returns table (user_id uuid, wins int, losses int, draws int, played int)
language sql
stable
security definer
set search_path = public
as $$
  with fin as (
    select g.player_a, g.player_b,
           case when g.status = 'done' then g.winner
                when g.turn = g.player_a then g.player_b
                else g.player_a end as w,
           (g.status = 'done' and g.end_reason = 'draw') as is_draw
    from public.game_matches g
    where g.game = p_game
      and (g.status = 'done' or (g.status = 'active' and g.turn_deadline < now() - interval '10 seconds'))
  ), per as (
    select player_a as u, w, is_draw from fin
    union all
    select player_b as u, w, is_draw from fin
  )
  select per.u,
         (count(*) filter (where not per.is_draw and per.w = per.u))::int,
         (count(*) filter (where not per.is_draw and per.w is distinct from per.u))::int,
         (count(*) filter (where per.is_draw))::int,
         count(*)::int
  from per
  where auth.uid() is not null
    and not exists (select 1 from public.blocked_users b where b.user_id = per.u)
  group by per.u
  order by 2 desc, 3 asc, 5 desc;
$$;

-- pravice
revoke all on function public.game_json(uuid) from public, anon;
revoke all on function public.c4_win(text, int) from public, anon;
revoke all on function public.game_challenge(uuid, text) from public, anon;
revoke all on function public.game_respond(uuid, boolean) from public, anon;
revoke all on function public.game_cancel(uuid) from public, anon;
revoke all on function public.game_move(uuid, int) from public, anon;
revoke all on function public.game_timeout(uuid) from public, anon;
revoke all on function public.game_resign(uuid) from public, anon;
revoke all on function public.game_leaderboard(text) from public, anon;
grant execute on function public.game_json(uuid) to authenticated;
grant execute on function public.game_challenge(uuid, text) to authenticated;
grant execute on function public.game_respond(uuid, boolean) to authenticated;
grant execute on function public.game_cancel(uuid) to authenticated;
grant execute on function public.game_move(uuid, int) to authenticated;
grant execute on function public.game_timeout(uuid) to authenticated;
grant execute on function public.game_resign(uuid) to authenticated;
grant execute on function public.game_leaderboard(text) to authenticated;

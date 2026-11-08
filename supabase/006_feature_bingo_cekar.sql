-- Enkratna objava (2026-11): Cekar in Bingo vsem uporabnikom.
-- 1) dostop: vsak ne-admin dobi bingo in cekar v app_access (če ga še nima);
-- 2) plošča: aplikacija, ki je uporabnik še nima na plošči, gre na njegovo
--    prvo prazno „+“ mesto (najprej cekar, nato bingo); če praznih mest ni
--    dovolj, se doda novo mesto na konec. Hub sam doda novo prazno „+“, ko
--    zmanjka praznih mest.
-- Idempotentno: ponoven zagon ne naredi ničesar.

insert into public.app_access (user_id, app_id)
select u.id, a.app_id
from auth.users u
cross join (values ('bingo'), ('cekar')) a(app_id)
where not exists (select 1 from public.admins ad where ad.user_id = u.id)
  and not exists (select 1 from public.app_access x where x.user_id = u.id and x.app_id = a.app_id);

with want as (
  select u.id as user_id, a.app_id,
         row_number() over (partition by u.id order by a.ord) as n
  from auth.users u
  cross join (values ('cekar', 0), ('bingo', 1)) a(app_id, ord)
  where exists (select 1 from public.user_dashboard_slots s where s.user_id = u.id)
    and not exists (select 1 from public.user_dashboard_slots s where s.user_id = u.id and s.app_id = a.app_id)
), empties as (
  select s.id, s.user_id, row_number() over (partition by s.user_id order by s.position) as n
  from public.user_dashboard_slots s
  where s.app_id is null
)
update public.user_dashboard_slots t
set app_id = w.app_id, updated_at = now()
from want w
join empties e on e.user_id = w.user_id and e.n = w.n
where t.id = e.id;

-- Kdor ni imel dovolj praznih mest: novo mesto na konec.
insert into public.user_dashboard_slots (user_id, app_id, position)
select w.user_id, w.app_id,
       (select max(s.position) from public.user_dashboard_slots s where s.user_id = w.user_id)
         + row_number() over (partition by w.user_id order by w.ord)
from (
  select u.id as user_id, a.app_id, a.ord
  from auth.users u
  cross join (values ('cekar', 0), ('bingo', 1)) a(app_id, ord)
  where exists (select 1 from public.user_dashboard_slots s where s.user_id = u.id)
    and not exists (select 1 from public.user_dashboard_slots s where s.user_id = u.id and s.app_id = a.app_id)
) w;

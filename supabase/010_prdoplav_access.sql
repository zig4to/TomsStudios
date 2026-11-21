-- Prdoplav vsem uporabnikom (2026-11).
-- 1) vsak obstoječi ne-admin dobi prdoplav v app_access (če ga še nima);
--    admini imajo dostop do vsega že sami.
-- 2) nov uporabnik ob registraciji poleg Dogodkov (mascajt) dobi tudi Prdoplav.
-- Idempotentno: ponoven zagon ne naredi ničesar.

insert into public.app_access (user_id, app_id)
select u.id, 'prdoplav'
from auth.users u
where not exists (select 1 from public.admins ad where ad.user_id = u.id)
  and not exists (select 1 from public.app_access x where x.user_id = u.id and x.app_id = 'prdoplav');

create or replace function public.grant_default_apps()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into app_access (user_id, app_id) values (new.id, 'mascajt') on conflict do nothing;
  insert into app_access (user_id, app_id) values (new.id, 'prdoplav') on conflict do nothing;
  return new;
end;
$$;

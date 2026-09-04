-- TomStudios — dodajanje povabljenih e-poštnih naslovov na seznam, ki sme
-- dokončati registracijo (glej 001_allowed_emails.sql). Zaženi v Supabase
-- SQL editorju. "on conflict do nothing" naredi skript varen za ponovni zagon.

insert into public.allowed_emails (email) values
  ('tina.brdnik@gmail.com')
on conflict (email) do nothing;

# Recept: povezava pod-aplikacije s prijavo v TomStudios

Ta dokument opisuje, kaj je treba dodati v posamezno pod-aplikacijo (Piši,
Dogodki, Računi, ...), ko jo povežemo z isto prijavo kot hub. TomStudios repo
tega ne implementira namesto njih — vsaka pod-aplikacija živi v svojem
repozitoriju.

## 1. Skupni Supabase projekt

Pod-aplikacija mora uporabljati **isti** Project URL in anon/publishable key kot
hub (glej `supabase-config.js` v tem repozitoriju). Brez tega prenos seje nima
smisla — žetoni veljajo samo znotraj enega Supabase projekta.

## 2. Če je pod-aplikacija na `zig4to.github.io` (GitHub Pages)

7 od 10 trenutnih aplikacij (Dogodki, Checkliste, Računi, Komadi, Iskra, Zdrav,
Kam) si **že delijo izvor** s hubom — GitHub Pages servira vse projekte enega
uporabnika pod eno domeno (`https://zig4to.github.io`), le pot je drugačna
(`/TomsStudios/`, `/Checkliste/` ...). `localStorage` (kamor supabase-js
privzeto shrani sejo) je vezan na izvor, ne na pot.

**Posledica:** če taka aplikacija doda Supabase klient z istim URL-jem/ključem
in **ne spremeni privzetega imena za shranjevanje seje** (ne nastavlja opcije
`storageKey` pri `createClient`), bo `supabase.auth.getSession()` ob nalaganju
strani že sam našel sejo, ki jo je pustil hub. Korak 3 (prenos prek URL-ja) v
tem primeru ni potreben — samo dodaj Supabase klient in preveri sejo ob
nalaganju, enako kot v `auth.js` tega repozitorija.

## 3. Če je pod-aplikacija na drugi domeni (npr. `*.vercel.app`)

Piši (`pisi-omega.vercel.app`), Posel (`posel-six.vercel.app`) in Viharnik
(`viharnik.vercel.app`) so vsaka na svoji ločeni poddomeni — to so trije
popolnoma ločeni izvori, tudi med seboj, zato si seje ne delijo samodejno.

Hub ob gradnji povezave do take aplikacije v URL doda žeton v delu za `#`
(fragment, ne poizvedbeni niz — fragmenti se ne pošiljajo strežniku/v dnevnike):

```js
// dashboard.js — buildAppUrl()
function buildAppUrl(appEntry, session) {
  var url = new URL(appEntry.url);
  if (session && session.access_token && session.refresh_token) {
    url.hash = "sb_at=" + encodeURIComponent(session.access_token) +
               "&sb_rt=" + encodeURIComponent(session.refresh_token);
  }
  return url.toString();
}
```

Pod-aplikacija ob nalaganju prebere ta fragment in prevzame sejo:

```js
(function () {
  var m = /sb_at=([^&]+)&sb_rt=([^&]+)/.exec(location.hash);
  if (!m) return;
  var access_token = decodeURIComponent(m[1]);
  var refresh_token = decodeURIComponent(m[2]);
  sb.auth.setSession({ access_token: access_token, refresh_token: refresh_token })
    .finally(function () {
      // Takoj počisti žeton iz naslovne vrstice/zgodovine brskalnika.
      history.replaceState(null, "", location.pathname + location.search);
    });
})();
```

**Varnostna opomba:** refresh token je dolgotrajen — ta prenos naj gre samo
prek HTTPS, hash pa se mora počistiti takoj po prevzemu seje. To je začasna,
"dovolj dobra" rešitev za osebno/družinsko rabo; za bolj robustno varnost bi
kasneje veljalo zamenjati z enkratno kodo prek Supabase Edge Function
(OAuth-podoben prenos), a to ni del trenutnega obsega.

## 4. Podatki po uporabnikih — obvezen vzorec za vsako tabelo

Da so podatki vsake pod-aplikacije lepo ločeni po uporabnikih (in ne vidni
drugim), mora vsaka njena tabela slediti istemu vzorcu kot
`user_dashboard_slots` v tem repozitoriju:

```sql
alter table public.<tvoja_tabela>
  add column if not exists user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade;

alter table public.<tvoja_tabela> enable row level security;

create policy "select own rows" on public.<tvoja_tabela>
  for select using (auth.uid() = user_id);
create policy "insert own rows" on public.<tvoja_tabela>
  for insert with check (auth.uid() = user_id);
create policy "update own rows" on public.<tvoja_tabela>
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own rows" on public.<tvoja_tabela>
  for delete using (auth.uid() = user_id);
```

**Pozor pri obstoječih tabelah:** če tabela že ima vrstice brez `user_id`, jih
vklop RLS takoj naredi nedostopne (nobena politika jih ne pokrije, dokler
`user_id` ni zapolnjen). Pred vklopom RLS jih je treba enkratno "posvojiti"
(nastaviti `user_id` na tvoj račun ali na ustreznega uporabnika), sicer stari
podatki po vklopu izginejo iz pogleda aplikacije (ostanejo v bazi, le API jih
ne bo vrnil).

# TomStudios

Domača stran (hub) s povezavami do vseh mojih aplikacij. Prijava in osebna
nadzorna plošča tečeta prek [Supabase](https://supabase.com).

## Zagon

Odpri `index.html` v brskalniku, ali `npm run dev` za lokalni strežnik. Ni
build koraka. Pred prvim zagonom uredi `supabase-config.js` (glej spodaj).

## Struktura

| Datoteka                    | Vsebina                                              |
|------------------------------|------------------------------------------------------|
| `index.html`                 | Naslov, prijava/registracija, mreža kartic, noga     |
| `styles.css`                 | Barvni sistem (svetla/temna tema), kartice, prijava  |
| `app.js`                     | Tema, nastavitve, namestitev, service worker         |
| `auth.js`                    | Prijava, registracija, odjava, preverjanje seje      |
| `apps-registry.js`           | Seznam vseh aplikacij (ikona, naslov, povezava, ...) |
| `dashboard.js`               | Osebna nadzorna plošča: mesta, izbirnik, razvrščanje |
| `supabase-config.js`         | Project URL in anon key za Supabase                  |
| `supabase/*.sql`             | SQL za tabele in RLS politike (zaženi enkrat)        |
| `docs/sso-integration-recipe.md` | Recept za povezavo pod-aplikacij s prijavo        |
| `manifest.json`              | Podatki za namestitev (ime, ikone, barve)            |
| `sw.js`                      | Service worker — namestljivost in delovanje offline  |
| `icons/`                     | Generirane PNG ikone                                 |
| `tools/generate-icons.js`    | Generator ikon (`npm run icons`)                     |
| `server.js`                  | Mini dev strežnik brez odvisnosti                    |

## Prijava in nadzorna plošča (Supabase)

Hub zahteva prijavo. Vsak uporabnik ob prvi prijavi dobi 6 praznih mest, ki
si jih sam zapolni prek "+" → izbirnik aplikacij. Razpored se shrani nanj
osebno v Supabase, ne v `localStorage`.

**Prva nastavitev:**

1. V Supabase nadzorni plošči (Project Settings → API) skopiraj **Project
   URL** in **anon/public key**, vpiši ju v `supabase-config.js`.
2. V Supabase SQL editorju po vrsti zaženi `supabase/001_allowed_emails.sql`
   in `supabase/002_user_dashboard_slots.sql`.
3. Registracija je namenoma omejena na povabljene: v `allowed_emails` dodaj
   vsak dovoljen e-poštni naslov, npr.:
   ```sql
   insert into public.allowed_emails (email) values ('ime@example.com');
   ```
4. Po želji v Authentication → Providers → Email izklopi "Confirm email" za
   takojšnjo prijavo brez potrditvenega sporočila (ali pusti vklopljeno).

Ko boš kasneje povezoval posamezno aplikacijo (Piši, Dogodki, ...) z isto
prijavo, sledi `docs/sso-integration-recipe.md` — tam je razloženo, katere
aplikacije dobijo prijavo samodejno (si že delijo izvor s hubom na GitHub
Pages) in katere potrebujejo dodaten korak (tiste na Vercelu), ter obvezen
vzorec `user_id` + RLS za lastne tabele vsake aplikacije.

## Namestitev na telefon

Stran je PWA. Na **Androidu (Chrome)** odpri objavljeno povezavo → **Nastavitve → Namesti
aplikacijo**, ali meni ⋮ → *Namesti aplikacijo*. Na **iPhonu (Safari)**: Deli → *Dodaj na
začetni zaslon*.

Pogoj je HTTPS — deluje na GitHub Pages, lokalno pa le prek `http://localhost`.
Ikono spremeniš v `tools/generate-icons.js` in zaženi `npm run icons`.

> Po vsaki spremembi datotek povečaj `VERZIJA` v `sw.js`, sicer nameščene naprave
> še nekaj časa vidijo staro različico iz predpomnilnika.

## Dodajanje nove aplikacije

Nove aplikacije se ne dodajajo več neposredno v `index.html`, temveč kot nov
zapis v `apps-registry.js`:

```js
{
  id: "nova-app",
  title: "Ime",
  subtitle: "Kratek opis",
  url: "POVEZAVA",
  accent: "#ec4899",
  accent2: "#f97316",
  icon: '<svg ...>...</svg>' // Lucide slog, prilepiš neposredno
}
```

`accent`/`accent2` določata barvni preliv ikone in sij ob hoverju. Ikone so v
slogu [Lucide](https://lucide.dev). Aplikacija se pojavi v izbirniku "+" na
nadzorni plošči — vsak uporabnik si jo sam doda na svoje mesto.

Če aplikacija dobi lastno prijavo prek Supabase, glej
`docs/sso-integration-recipe.md` za povezavo s prijavo v hubu.

## Objava na GitHub Pages

```bash
git init && git add . && git commit -m "Hub TomStudios"
git branch -M main
git remote add origin https://github.com/zig4to/<ime-repota>.git
git push -u origin main
```

Nato v nastavitvah repota: **Settings → Pages → Deploy from branch → main / root**.

# Pr'Tomšetu

Domača stran (hub) s povezavami do vseh mojih aplikacij.

## Zagon

Odpri `index.html` v brskalniku. Ni build koraka, ni odvisnosti.

## Struktura

| Datoteka     | Vsebina                                    |
|--------------|--------------------------------------------|
| `index.html` | Naslov, mreža kartic, noga                 |
| `styles.css` | Barvni sistem (svetla/temna tema), kartice |
| `app.js`     | Preklop teme, letnica v nogi               |

## Dodajanje nove kartice

V `index.html` zamenjaj enega od blokov `<div class="card card--empty">` s povezavo:

```html
<a class="card" style="--accent:#ec4899; --accent-2:#f97316" href="POVEZAVA" target="_blank" rel="noopener">
  <span class="card-icon"><!-- SVG ikona --></span>
  <span class="card-body">
    <span class="card-title">Ime</span>
    <span class="card-sub">Kratek opis</span>
  </span>
  <span class="card-arrow" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>
  </span>
</a>
```

`--accent` in `--accent-2` določata barvni preliv ikone in sij ob hoverju.
Ikone so v slogu [Lucide](https://lucide.dev) — SVG prilepiš neposredno v `card-icon`.

## Objava na GitHub Pages

```bash
git init && git add . && git commit -m "Hub Pr'Tomšetu"
git branch -M main
git remote add origin https://github.com/zig4to/<ime-repota>.git
git push -u origin main
```

Nato v nastavitvah repota: **Settings → Pages → Deploy from branch → main / root**.

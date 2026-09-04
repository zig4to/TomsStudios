/* TomStudios — seznam vseh aplikacij.
   Vsaka aplikacija je en zapis: id (ujema se z app_id v Supabase), naslov,
   podnaslov, povezava, barvni preliv ikone in SVG ikona (v slogu Lucide).
   Ko dodajaš novo aplikacijo, ji tu dodaj zapis — v index.html se ne dotikaš
   ničesar, kartica se izriše samodejno prek dashboard.js. */
(function () {
  "use strict";

  window.PTOMSETU_APPS = [
    {
      id: "mascajt",
      title: "Dogodki",
      subtitle: "Koledar in termini",
      url: "https://zig4to.github.io/masCajt/",
      accent: "#6366f1",
      accent2: "#a855f7",
      icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M7.5 13.5h3M7.5 17h6"/>' +
        "</svg>"
    },
    {
      id: "pisi",
      title: "Piši",
      subtitle: "Beležke in zapiski",
      url: "https://pisi-omega.vercel.app/",
      accent: "#6366f1",
      accent2: "#3b82f6",
      icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M2 6h4M2 10h4M2 14h4M2 18h4"/><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M16 2v20"/>' +
        "</svg>"
    },
    {
      id: "checkliste",
      title: "Checkliste",
      subtitle: "Opravila po korakih",
      url: "https://zig4to.github.io/Checkliste/",
      accent: "#10b981",
      accent2: "#22d3ee",
      icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9 3.5h6A1.5 1.5 0 0 1 16.5 5v.5H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2h1.5V5A1.5 1.5 0 0 1 9 3.5Z"/>' +
        '<path d="m8.5 12.5 2 2 4-4.5"/><path d="M8.5 18h7"/>' +
        "</svg>"
    },
    {
      id: "racuni",
      title: "Računi",
      subtitle: "Izdaja in pregled",
      url: "https://zig4to.github.io/Racuni/",
      accent: "#f59e0b",
      accent2: "#fb7185",
      icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M6 2.5h12v19l-2.5-1.6L13 21.5l-2.5-1.6L8 21.5l-2-1.6Z"/><path d="M9.5 8h5M9.5 12h5M9.5 16h3"/>' +
        "</svg>"
    },
    {
      id: "komadi",
      title: "Komadi",
      subtitle: "Priljubljene skladbe",
      url: "https://zig4to.github.io/Komadi/",
      accent: "#ec4899",
      accent2: "#f97316",
      icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' +
        "</svg>"
    },
    {
      id: "iskra",
      title: "Iskra",
      subtitle: "Ideje in izboljšave",
      url: "https://zig4to.github.io/Iskra/",
      accent: "#f59e0b",
      accent2: "#ef4444",
      icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>' +
        "</svg>"
    },
    {
      id: "zdrav",
      title: "Zdrav",
      subtitle: "Zdravi obroki",
      url: "https://zig4to.github.io/Zdrav/",
      accent: "#22c55e",
      accent2: "#16a34a",
      icon:
        '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor">' +
        '<circle cx="12" cy="9.8" r="4"/><circle cx="12" cy="15.3" r="7"/>' +
        '<path d="M12 5.8 L12 3.2" stroke-width="1.4" stroke-linecap="round"/>' +
        '<path d="M12 4.1 Q14.2 2.4 15.7 3 Q14.8 5.3 12 4.1 Z" stroke="none"/>' +
        "</svg>"
    },
    {
      id: "kam",
      title: "Kam",
      subtitle: "Naključna pohodna točka",
      url: "https://zig4to.github.io/Kam/",
      accent: "#38bdf8",
      accent2: "#0f766e",
      icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M4 17.5 L9 8 L12 12 L15 6 L20 17.5 Z"/><path d="M8.16 9.6 L9 8 L10.2 9.6 M14.2 7.6 L15 6 L15.7 7.6"/>' +
        "</svg>"
    },
    {
      id: "posel",
      title: "Posel",
      subtitle: "Stranke in koledar",
      url: "https://posel-six.vercel.app/",
      accent: "#93a2c6",
      accent2: "#282c47",
      icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3.6" y="8.4" width="16.8" height="11.6" rx="3.4"/><path d="M9.4 8.4V7a2.4 2.4 0 0 1 2.4-2.4h0.4a2.4 2.4 0 0 1 2.4 2.4v1.4"/>' +
        "</svg>"
    },
    {
      id: "viharnik",
      title: "Viharnik",
      subtitle: "Gorska vremenska napoved",
      url: "https://viharnik.vercel.app/",
      accent: "#6d5cf5",
      accent2: "#facc15",
      icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><path d="M13 11 9 17h6l-4 6"/>' +
        "</svg>"
    }
  ];
})();

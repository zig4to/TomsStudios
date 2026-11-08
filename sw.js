/* Service worker — omogoča namestitev in delovanje brez povezave.
   Ob spremembi datotek povečaj VERZIJO, da se predpomnilnik osveži. */

const VERZIJA = "v87";
const CACHE = "ptomsetu-" + VERZIJA;

const LUPINA = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./auth.js",
  "./dashboard.js",
  "./admin.html",
  "./admin.js",
  "./seri.html",
  "./seri.js",
  "./seri.css",
  "./seri-common.js",
  "./inbox.js",
  "./chat.html",
  "./chat.js",
  "./chat.css",
  "./chat-mini.js",
  "./hub-back.js",
  "./games.js",
  "./games.css",
  "./igra.html",
  "./igra.js",
  "./apps-registry.js",
  "./supabase-config.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/favicon-32.png",
  "./icons/apple-touch-icon-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // posamezne napake (npr. manjkajoča ikona) ne smejo podreti namestitve
      // cache: "reload" → mimo HTTP predpomnilnika (GitHub Pages: max-age 10 min),
      // sicer bi nova verzija lahko dobila star styles.css ob nove skripte
      .then((c) => Promise.allSettled(LUPINA.map((u) => c.add(new Request(u, { cache: "reload" })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // pisave in tuje povezave prepusti brskalniku

  // Navigacija: najprej mreža, ob izpadu predpomnjena stran.
  // admin.html, seri.html in chat.html so ločene strani — shrani se pod svojim imenom, sicer bi brez
  // povezave namesto plošče odprla drugo stran.
  if (req.mode === "navigate") {
    const stran = url.pathname.endsWith("/admin.html") ? "./admin.html"
      : url.pathname.endsWith("/seri.html") ? "./seri.html"
      : url.pathname.endsWith("/chat.html") ? "./chat.html"
      : url.pathname.endsWith("/igra.html") ? "./igra.html"
      : "./index.html";
    e.respondWith(
      fetch(req)
        .then((res) => {
          const kopija = res.clone();
          caches.open(CACHE).then((c) => c.put(stran, kopija));
          return res;
        })
        .catch(() => caches.match(stran).then((r) => r || caches.match("./")))
    );
    return;
  }

  // Ostalo: najprej mreža (no-cache = preverjanje z ETag, 304 je poceni), ob izpadu
  // predpomnilnik. Prej je bilo „iz predpomnilnika takoj“ — po objavi se je nova
  // stran zmešala s starim styles.css (nove skripte, stari stili).
  e.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (res && res.ok) {
          const kopija = res.clone();
          caches.open(CACHE).then((c) => c.put(req, kopija));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || Response.error()))
  );
});

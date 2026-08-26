/* Service worker — omogoča namestitev in delovanje brez povezave.
   Ob spremembi datotek povečaj VERZIJO, da se predpomnilnik osveži. */

const VERZIJA = "v6";
const CACHE = "ptomsetu-" + VERZIJA;

const LUPINA = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
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
      .then((c) => Promise.allSettled(LUPINA.map((u) => c.add(u))))
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
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const kopija = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", kopija));
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // Ostalo: iz predpomnilnika takoj, v ozadju osveži.
  e.respondWith(
    caches.match(req).then((zadetek) => {
      const mreza = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const kopija = res.clone();
            caches.open(CACHE).then((c) => c.put(req, kopija));
          }
          return res;
        })
        .catch(() => zadetek);
      return zadetek || mreza;
    })
  );
});

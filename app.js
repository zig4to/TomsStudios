/* TomStudios — hub aplikacij */
(function () {
  "use strict";

  var root = document.documentElement;
  var label = document.getElementById("themeLabel");

  function paintLabel(theme) {
    if (label) label.textContent = theme === "dark" ? "Temna tema" : "Svetla tema";
  }

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0b1020" : "#f6f7fb");
    paintLabel(theme);
    try { localStorage.setItem("ptomsetu-theme", theme); } catch (e) { /* private mode */ }
  }

  paintLabel(root.getAttribute("data-theme"));

  var toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });
  }

  // Gumb Nastavitve razgrne ploščo pod sabo.
  var settingsBtn = document.getElementById("settingsBtn");
  var panel = document.getElementById("settingsPanel");
  if (settingsBtn && panel) {
    settingsBtn.addEventListener("click", function () {
      var open = settingsBtn.getAttribute("aria-expanded") === "true";
      settingsBtn.setAttribute("aria-expanded", String(!open));
      panel.hidden = open;
    });
  }

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Trd reset: pobriše service worker + predpomnilnik in stran naloži znova
  // neposredno s strežnika (kot Ctrl+F5). getRegistrations()/caches.keys() brez
  // scope filtra zajameta VSE aplikacije na istem izvoru (zig4to.github.io), ne
  // le TomStudios - zato ta gumb dejansko osveži vse aplikacije naenkrat.
  function hardReset(btn) {
    btn.disabled = true;
    btn.classList.add("is-spinning");

    var poNaloziPonovno = function () {
      var url = new URL(location.href);
      url.searchParams.set("_r", Date.now());
      location.replace(url.toString());
    };

    Promise.resolve()
      .then(function () {
        if (!("serviceWorker" in navigator)) return;
        return navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(regs.map(function (r) { return r.unregister(); }));
        });
      })
      .then(function () {
        if (!("caches" in window)) return;
        return caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) { return caches.delete(k); }));
        });
      })
      .catch(function (e) { console.warn("Trd reset ni v celoti uspel:", e); })
      .then(poNaloziPonovno);
  }

  var hardResetAllBtn = document.getElementById("hardResetAllBtn");
  if (hardResetAllBtn) hardResetAllBtn.addEventListener("click", function () { hardReset(hardResetAllBtn); });

  /* ---------- Namestitev kot aplikacija (PWA) ---------- */

  var installBtn = document.getElementById("installBtn");
  var installHint = document.getElementById("installHint");
  var deferred = null;

  // Ponudbeno okno (sproži ga dodajanje na ploščo in prvih 5 prijav).
  var promoModal = document.getElementById("installPromoModal");
  var promoPrimary = document.getElementById("installPromoPrimary");
  var promoPrimaryLabel = document.getElementById("installPromoPrimaryLabel");
  var promoCancel = document.getElementById("installPromoCancel");
  var promoIos = document.getElementById("installPromoIos");
  var promoReason = null;       // "dashboard-add" | "login"
  var promoIsIos = false;       // odprta je iOS različica (ročna navodila)
  var pendingLoginPromo = false;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* zasebni način */ } }

  function jeNamescena() {
    return window.matchMedia("(display-mode: standalone)").matches ||
           window.navigator.standalone === true;
  }

  function jeIOS() {
    var ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    // iPadOS se javi kot Mac; loči ga zaslon na dotik.
    return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  }

  function verjetnoNamescena() {
    return jeNamescena() || lsGet("ptomsetu-installed") === "1";
  }

  // Kjer je na voljo (Chromium): če je PWA že nameščen, si to trajno zapomni,
  // da uporabnika ne sprašujemo niti, ko stran odpre v navadnem zavihku.
  if (navigator.getInstalledRelatedApps) {
    try {
      navigator.getInstalledRelatedApps().then(function (apps) {
        if (apps && apps.length) lsSet("ptomsetu-installed", "1");
      }).catch(function () { /* ni pomembno */ });
    } catch (e) { /* ni pomembno */ }
  }

  function pokaziNamig(besedilo) {
    if (!installHint) return;
    installHint.textContent = besedilo;
    installHint.hidden = false;
  }

  function sprozNamestitev() {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function (izbira) {
      if (izbira.outcome === "accepted" && installBtn) installBtn.hidden = true;
      deferred = null;
    });
  }

  function odpriPonudbo(reason) {
    if (!promoModal) return;
    promoReason = reason;
    promoIsIos = !deferred && jeIOS();

    if (promoIsIos) {
      if (promoIos) {
        promoIos.textContent = "V Safariju: Deli → Dodaj na začetni zaslon.";
        promoIos.hidden = false;
      }
      if (promoPrimaryLabel) promoPrimaryLabel.textContent = "Razumem";
      if (promoCancel) promoCancel.hidden = true;
    } else {
      if (promoIos) { promoIos.hidden = true; promoIos.textContent = ""; }
      if (promoPrimaryLabel) promoPrimaryLabel.textContent = "Namesti";
      if (promoCancel) promoCancel.hidden = false;
    }

    promoModal.hidden = false;
    if (promoPrimary) promoPrimary.focus();
  }

  function zapriPonudbo(reason) {
    if (!promoModal) return;
    promoModal.hidden = true;
    if (reason === "login") lsSet("ptomsetu-login-promo", "done");
    if (promoIsIos) lsSet("ptomsetu-ios-promo-off", "1");
    promoReason = null;
    promoIsIos = false;
  }

  function maybeShowPromo(reason) {
    if (verjetnoNamescena()) return;
    if (!deferred && !jeIOS()) {
      // Ni namestljive poti (npr. namizni Firefox). Za prijavo si zapomni, da
      // poskusimo znova, če kasneje pride beforeinstallprompt.
      if (reason === "login") pendingLoginPromo = true;
      return;
    }
    if (jeIOS() && lsGet("ptomsetu-ios-promo-off") === "1") return;
    if (reason === "login" && lsGet("ptomsetu-login-promo") === "done") return;
    if (!promoModal || !promoModal.hidden) return;   // manjka ali že odprto
    pendingLoginPromo = false;
    odpriPonudbo(reason);
  }

  // Chrome sproži ta dogodek, ko je stran namestljiva.
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    if (installBtn) installBtn.hidden = false;
    if (installHint) installHint.hidden = true;
    if (pendingLoginPromo) maybeShowPromo("login");
  });

  if (installBtn) {
    installBtn.addEventListener("click", sprozNamestitev);
  }

  if (promoPrimary) {
    promoPrimary.addEventListener("click", function () {
      var reason = promoReason;
      zapriPonudbo(reason);
      sprozNamestitev();   // na iOS ni deferred → samo zapre (navodila so že prikazana)
    });
  }
  if (promoCancel) {
    promoCancel.addEventListener("click", function () { zapriPonudbo(promoReason); });
  }
  if (promoModal) {
    promoModal.addEventListener("click", function (e) {
      if (e.target === promoModal) zapriPonudbo(promoReason);
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && promoModal && !promoModal.hidden) zapriPonudbo(promoReason);
  });

  window.addEventListener("appinstalled", function () {
    deferred = null;
    lsSet("ptomsetu-installed", "1");
    lsSet("ptomsetu-login-promo", "done");
    if (installBtn) installBtn.hidden = true;
    if (promoModal && !promoModal.hidden) { promoModal.hidden = true; promoReason = null; }
    pokaziNamig("Aplikacija je nameščena.");
  });

  // Štetje prijav (odprtij aplikacije). "ptomsetu:signed-in" sproži auth.js ob
  // vsakem odprtju prek shranjene seje in ob osvežitvi žetona — zato štejemo
  // največ enkrat na sejo zavihka.
  document.addEventListener("ptomsetu:signed-in", function () {
    try {
      if (sessionStorage.getItem("ptomsetu-login-counted")) return;
      sessionStorage.setItem("ptomsetu-login-counted", "1");
    } catch (e) { /* zasebni način — ni kritično */ }
    var n = (parseInt(lsGet("ptomsetu-login-count"), 10) || 0) + 1;
    lsSet("ptomsetu-login-count", String(n));
    if (n <= 5) maybeShowPromo("login");
    if (n >= 5) lsSet("ptomsetu-login-promo", "done");
  });

  // Izpostavljeno za dashboard.js (ločena IIFE; app.js se naloži zadnji).
  window.ptomsetuInstall = { maybeShowPromo: maybeShowPromo };

  // Če gumba ni (iOS ali že nameščeno), po kratkem zamiku pokaži navodilo.
  if (!jeNamescena()) {
    setTimeout(function () {
      if (deferred || (installBtn && !installBtn.hidden)) return;
      var ua = navigator.userAgent;
      if (/iPhone|iPad|iPod/i.test(ua)) {
        pokaziNamig("V Safariju: Deli → Dodaj na začetni zaslon.");
      } else if (/Android/i.test(ua)) {
        pokaziNamig("V Chromu: meni ⋮ → Namesti aplikacijo.");
      }
    }, 2500);
  }

  /* ---------- Service worker ---------- */

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function (e) {
        console.warn("Service worker ni bil registriran:", e);
      });
    });
  }
})();

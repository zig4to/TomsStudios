/* Pr'Tomšetu — hub aplikacij */
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
  // le Pr'Tomšetu - zato oba spodnja gumba dejansko naredita isto stvar.
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

  var hardResetBtn = document.getElementById("hardResetBtn");
  if (hardResetBtn) hardResetBtn.addEventListener("click", function () { hardReset(hardResetBtn); });

  var hardResetAllBtn = document.getElementById("hardResetAllBtn");
  if (hardResetAllBtn) hardResetAllBtn.addEventListener("click", function () { hardReset(hardResetAllBtn); });

  /* ---------- Namestitev kot aplikacija (PWA) ---------- */

  var installBtn = document.getElementById("installBtn");
  var installHint = document.getElementById("installHint");
  var deferred = null;

  function jeNamescena() {
    return window.matchMedia("(display-mode: standalone)").matches ||
           window.navigator.standalone === true;
  }

  function pokaziNamig(besedilo) {
    if (!installHint) return;
    installHint.textContent = besedilo;
    installHint.hidden = false;
  }

  // Chrome sproži ta dogodek, ko je stran namestljiva.
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    if (installBtn) installBtn.hidden = false;
    if (installHint) installHint.hidden = true;
  });

  if (installBtn) {
    installBtn.addEventListener("click", function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function (izbira) {
        if (izbira.outcome === "accepted") installBtn.hidden = true;
        deferred = null;
      });
    });
  }

  window.addEventListener("appinstalled", function () {
    deferred = null;
    if (installBtn) installBtn.hidden = true;
    pokaziNamig("Aplikacija je nameščena.");
  });

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

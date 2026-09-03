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
  // le Pr'Tomšetu - zato ta gumb dejansko osveži vse aplikacije naenkrat.
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

  /* ---------- Ročno razvrščanje kartic ----------
     Gumb "Uredi razpored" vklopi način urejanja; kartice se premikajo z
     vlečenjem (miška takoj ob premiku, dotik po kratkem pridržanju). Vrstni
     red se shrani v localStorage ("ptomsetu-card-order"); uveljavi ga inline
     skript v index.html še pred izrisom. */

  var reorderBtn = document.getElementById("reorderBtn");
  var reorderLabel = document.getElementById("reorderLabel");
  var grid = document.querySelector(".grid");

  if (reorderBtn && reorderLabel && grid) {
    var ORDER_KEY = "ptomsetu-card-order";

    var jeUrejanje = function () {
      return document.body.classList.contains("is-reordering");
    };

    var saveOrder = function () {
      var cards = grid.querySelectorAll(".card");
      var ids = [];
      for (var i = 0; i < cards.length; i++) {
        var id = cards[i].getAttribute("data-app");
        if (id) ids.push(id);
      }
      try { localStorage.setItem(ORDER_KEY, JSON.stringify(ids)); } catch (e) { /* zasebni način / poln disk */ }
    };

    // Ročaj za premikanje v zgornjem desnem kotu vsake kartice. Viden je le v
    // načinu urejanja; premik se sproži IZKLJUČNO ob prijemu tega ročaja, da
    // ostane drsenje po strani gladko (preostanek kartice ne prestreže poteze).
    var GRIP_ICON =
      '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">' +
      '<circle cx="9" cy="5" r="1.6"/><circle cx="15" cy="5" r="1.6"/>' +
      '<circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>' +
      '<circle cx="9" cy="19" r="1.6"/><circle cx="15" cy="19" r="1.6"/></svg>';

    var ensureGrips = function () {
      var cards = grid.querySelectorAll(".card");
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].querySelector(".card-grip")) continue;
        var g = document.createElement("span");
        g.className = "card-grip";
        g.setAttribute("aria-hidden", "true");
        g.setAttribute("title", "Povleci za premik");
        g.innerHTML = GRIP_ICON;
        cards[i].appendChild(g);
      }
    };
    ensureGrips();

    var setReorder = function (on) {
      document.body.classList.toggle("is-reordering", on);
      reorderBtn.setAttribute("aria-pressed", String(on));
      reorderLabel.textContent = on ? "Končaj urejanje" : "Uredi razpored";
      if (!on) { endDrag(); saveOrder(); }
    };

    reorderBtn.addEventListener("click", function () {
      setReorder(reorderBtn.getAttribute("aria-pressed") !== "true");
    });

    // Med urejanjem klik na kartico ne sme odpreti aplikacije.
    grid.addEventListener("click", function (e) {
      if (!jeUrejanje()) return;
      var c = e.target.closest ? e.target.closest(".card") : null;
      if (c) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    // Med urejanjem brskalnik ne sme sprožiti lastnega vlečenja povezave
    // (na namizju to prekine našo Pointer-Events sled in vlečenje "ne deluje").
    grid.addEventListener("dragstart", function (e) {
      if (jeUrejanje()) e.preventDefault();
    });

    /* --- Vlečenje prek Pointer Events (miška + dotik) --- */
    var drag = null;        // { card, pointerId, offsetX, offsetY, clone, started, lastX, lastY }
    var startX = 0, startY = 0;

    var moveClone = function (x, y) {
      if (!drag || !drag.clone) return;
      drag.clone.style.transform =
        "translate(" + (x - drag.offsetX) + "px," + (y - drag.offsetY) + "px) scale(1.04)";
    };

    var beginDrag = function () {
      if (!drag || drag.started) return;
      var card = drag.card;
      var r = card.getBoundingClientRect();
      var clone = card.cloneNode(true);
      clone.classList.add("card-drag-clone");
      clone.classList.remove("is-dragging");
      clone.removeAttribute("href");
      clone.style.width = r.width + "px";
      clone.style.height = r.height + "px";
      document.body.appendChild(clone);
      card.classList.add("is-dragging");
      try { card.setPointerCapture(drag.pointerId); } catch (e) {}
      drag.clone = clone;
      drag.started = true;
      moveClone(drag.lastX, drag.lastY);
    };

    var reorderTo = function (x, y) {
      var card = drag.card;
      drag.clone.style.visibility = "hidden";
      var over = document.elementFromPoint(x, y);
      drag.clone.style.visibility = "";
      if (!over) return;
      var target = over.closest ? over.closest(".card") : null;
      if (target && target !== card && target.parentNode === grid) {
        var r = target.getBoundingClientRect();
        var after = x > r.left + r.width / 2;
        grid.insertBefore(card, after ? target.nextSibling : target);
      } else if (over === grid) {
        var last = grid.lastElementChild;
        if (last && last !== card && y > last.getBoundingClientRect().top) {
          grid.appendChild(card);
        }
      }
    };

    function endDrag() {
      if (!drag) return;
      var card = drag.card;
      if (drag.pointerId != null) {
        try { card.releasePointerCapture(drag.pointerId); } catch (e) {}
      }
      if (drag.clone && drag.clone.parentNode) drag.clone.parentNode.removeChild(drag.clone);
      card.classList.remove("is-dragging");
      var started = drag.started;
      drag = null;
      if (started) saveOrder();
    }

    grid.addEventListener("pointerdown", function (e) {
      if (!jeUrejanje() || drag) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      // Premik se sproži samo ob prijemu ročaja v kotu kartice — drugod po
      // kartici gre poteza brskalniku (gladko drsenje po strani).
      var grip = e.target.closest ? e.target.closest(".card-grip") : null;
      if (!grip) return;
      var card = grip.closest(".card");
      if (!card || card.parentNode !== grid) return;

      // prepreči izbor besedila / fokus / začetek vlečenja povezave
      if (e.cancelable) e.preventDefault();

      var r = card.getBoundingClientRect();
      drag = {
        card: card,
        pointerId: e.pointerId,
        offsetX: e.clientX - r.left,
        offsetY: e.clientY - r.top,
        clone: null,
        started: false,
        lastX: e.clientX,
        lastY: e.clientY
      };
      startX = e.clientX;
      startY = e.clientY;
    });

    grid.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.pointerId) return;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;

      if (!drag.started) {
        var dx = e.clientX - startX, dy = e.clientY - startY;
        if (Math.sqrt(dx * dx + dy * dy) > 4) beginDrag();
        if (!drag || !drag.started) return;
      }

      e.preventDefault();
      moveClone(e.clientX, e.clientY);
      reorderTo(e.clientX, e.clientY);
    }, { passive: false });

    grid.addEventListener("pointerup", endDrag);
    grid.addEventListener("pointercancel", endDrag);
  }

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

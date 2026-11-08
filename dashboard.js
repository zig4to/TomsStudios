/* Bitneverse — osebna nadzorna plošča.
   Posluša "ptomsetu:signed-in"/"ptomsetu:signed-out" (sproženo v auth.js).
   Vsako mesto (slot) je ena vrstica v Supabase tabeli user_dashboard_slots:
   app_id = null pomeni prazno "+" mesto. Razpored kartic (vlečenje, dodajanje
   mesta, dodelitev/odstranitev aplikacije) se piše nazaj v Supabase, z
   localStorage predpomnilnikom na uporabnika za takojšen izris ob nalaganju. */
(function () {
  "use strict";

  var grid = document.getElementById("appGrid");
  if (!grid) return;

  var APPS = window.PTOMSETU_APPS || [];
  var APPS_BY_ID = {};
  APPS.forEach(function (a) { APPS_BY_ID[a.id] = a; });

  var DEFAULT_SLOT_COUNT = 6;
  // Aplikacije, ki jih nov uporabnik ob prvi prijavi že najde na plošči (po
  // vrsti na prvih mestih); ostala mesta so prazna "+". Velja samo za nove —
  // obstoječih plošč to ne spremeni.
  var DEFAULT_APP_IDS = ["mascajt"];
  var slots = [];          // { id, app_id, position }
  var session = null;
  var cacheKey = null;
  // Pravice iz my_access() (supabase/005_admin.sql): { is_admin, blocked, apps }.
  // null = še ni znano ali funkcije v bazi še ni — takrat je vse dovoljeno
  // kot pred administracijo, da plošča ne ostane prazna.
  var access = null;

  var ARROW_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>';
  var PLUS_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
  var GRIP_ICON =
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">' +
    '<circle cx="9" cy="5" r="1.6"/><circle cx="15" cy="5" r="1.6"/>' +
    '<circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>' +
    '<circle cx="9" cy="19" r="1.6"/><circle cx="15" cy="19" r="1.6"/></svg>';
  var REMOVE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  var CHECK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  /* ---------- Izpostavljene nove aplikacije („Novo“) ---------- */

  var FEATURED = window.PTOMSETU_FEATURED || null;
  var FEATURED_DISMISS_KEY = "ptomsetu-featured-dismissed";
  var featuredEl = document.getElementById("featured");

  function featuredDismissed() {
    if (!FEATURED) return true;
    // Potekel rok izpostavitve (lokalni datum YYYY-MM-DD)?
    if (FEATURED.until) {
      var d = new Date();
      var today = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
      if (today >= FEATURED.until) return true;
    }
    try { return localStorage.getItem(FEATURED_DISMISS_KEY) === FEATURED.key; } catch (e) { return false; }
  }

  function isFeatured(appId) {
    return !!FEATURED && !featuredDismissed() &&
      FEATURED.apps.some(function (f) { return f.id === appId; });
  }

  function renderFeatured() {
    if (!featuredEl) return;
    featuredEl.innerHTML = "";
    var items = !FEATURED || featuredDismissed() || (access && access.blocked)
      ? []
      : FEATURED.apps.filter(function (f) { return APPS_BY_ID[f.id] && canUse(f.id); });
    featuredEl.hidden = items.length === 0;
    if (!items.length) return;

    var head = document.createElement("div");
    head.className = "featured-head";
    var label = document.createElement("span");
    label.className = "featured-label";
    label.innerHTML = '<span class="featured-spark" aria-hidden="true">\u2726</span>';
    label.appendChild(document.createTextNode(FEATURED.title));
    var close = document.createElement("button");
    close.type = "button";
    close.className = "featured-close";
    close.setAttribute("aria-label", "Skrij novosti");
    close.innerHTML = REMOVE_ICON;
    close.addEventListener("click", function () {
      try { localStorage.setItem(FEATURED_DISMISS_KEY, FEATURED.key); } catch (e) {}
      render();
    });
    head.appendChild(label);
    head.appendChild(close);
    featuredEl.appendChild(head);

    var row = document.createElement("div");
    row.className = "featured-row";
    items.forEach(function (f) {
      var app = APPS_BY_ID[f.id];
      var a = document.createElement("a");
      a.className = "featured-card";
      a.style.setProperty("--accent", app.accent);
      a.style.setProperty("--accent-2", app.accent2);
      a.href = buildAppUrl(app, session);
      if (isStandalone() && !inHubScope(a.href)) { a.target = "_blank"; a.rel = "noopener"; }

      // Vrstica: ikona | ime + NOVO, podnaslov | i, Odpri.
      // Opis (f.text) je pod vrstico, viden šele po kliku na „i“.
      var main = document.createElement("span");
      main.className = "featured-main";

      var icon = document.createElement("span");
      icon.className = "featured-icon";
      icon.innerHTML = app.icon;

      var body = document.createElement("span");
      body.className = "featured-body";
      var titleRow = document.createElement("span");
      titleRow.className = "featured-title-row";
      var title = document.createElement("span");
      title.className = "featured-title";
      title.textContent = app.title;
      var badge = document.createElement("span");
      badge.className = "badge-new";
      badge.textContent = "NOVO";
      titleRow.appendChild(title);
      titleRow.appendChild(badge);
      var sub = document.createElement("span");
      sub.className = "featured-sub";
      sub.textContent = app.subtitle;
      body.appendChild(titleRow);
      body.appendChild(sub);

      var actions = document.createElement("span");
      actions.className = "featured-actions";
      // Gumb „i“: pokaže/skrije opis, aplikacije ne odpre.
      var info = document.createElement("button");
      info.type = "button";
      info.className = "featured-info";
      info.textContent = "i";
      info.setAttribute("aria-label", "Opis aplikacije " + app.title);
      info.setAttribute("aria-expanded", "false");
      info.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var open = a.classList.toggle("is-info-open");
        info.setAttribute("aria-expanded", open ? "true" : "false");
      });
      var cta = document.createElement("span");
      cta.className = "featured-cta";
      cta.innerHTML = "<span>Odpri</span>" + ARROW_SVG;
      actions.appendChild(info);
      actions.appendChild(cta);

      main.appendChild(icon);
      main.appendChild(body);
      main.appendChild(actions);

      var text = document.createElement("span");
      text.className = "featured-text";
      text.textContent = f.text || app.subtitle;

      a.appendChild(main);
      a.appendChild(text);
      row.appendChild(a);
    });
    featuredEl.appendChild(row);
  }

  // Nastavljeno spodaj (znotraj bloka za vlečenje razvrščanja), a poklicano
  // tudi iz render() — zato deklarirano tu, da je vidno v celotnem obsegu.
  var toggleEndCap;

  /* ---------- Pomožno ---------- */

  function jeUrejanje() {
    return document.body.classList.contains("is-reordering");
  }

  // Aplikacije z več možnimi naslovi (urls): prvi, ki se odzove. Odgovor brez CORS
  // (opaque) je dovolj — pomeni, da strežnik na tem naslovu teče.
  var reachableUrl = {};
  var probing = {};

  function probeUrls(appEntry) {
    if (!appEntry.urls || probing[appEntry.id]) return;
    probing[appEntry.id] = true;
    appEntry.urls.forEach(function (u) {
      var ctl = window.AbortController ? new AbortController() : null;
      var t = setTimeout(function () { if (ctl) ctl.abort(); }, 3000);
      fetch(u + "manifest.webmanifest?t=" + Date.now(), { mode: "no-cors", cache: "no-store", signal: ctl && ctl.signal })
        .then(function () {
          clearTimeout(t);
          if (reachableUrl[appEntry.id]) return;
          reachableUrl[appEntry.id] = u;
          var card = grid.querySelector('[data-app="' + appEntry.id + '"]');
          if (card) card.href = buildAppUrl(appEntry, session);
        }, function () { clearTimeout(t); });
    });
  }

  function buildAppUrl(appEntry, sess) {
    var url;
    try {
      url = new URL(reachableUrl[appEntry.id] || appEntry.url);
    } catch (e) {
      return appEntry.url;
    }
    if (!appEntry.noToken && sess && sess.access_token && sess.refresh_token) {
      url.hash =
        "sb_at=" + encodeURIComponent(sess.access_token) +
        "&sb_rt=" + encodeURIComponent(sess.refresh_token);
    }
    return url.toString();
  }

  function showToast(text) {
    var toast = document.getElementById("ptomsetuToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "ptomsetuToast";
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add("is-visible");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toast.classList.remove("is-visible"); }, 3200);
  }

  function saveCache() {
    if (!cacheKey) return;
    try {
      var lean = slots.map(function (s) { return { id: s.id, app_id: s.app_id, position: s.position }; });
      localStorage.setItem(cacheKey, JSON.stringify(lean));
    } catch (e) { /* zasebni način / poln disk */ }
  }

  function loadCache() {
    if (!cacheKey) return null;
    try {
      var raw = localStorage.getItem(cacheKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* ---------- Izris ---------- */

  function inHubScope(href) {
    try { return new URL(href, location.href).origin === location.origin; } catch (e) { return false; }
  }
  // oznaka okna plošče: hub-back.js v aplikacijah pokaže gumb nazaj samo v tem oknu
  try { if (isStandalone()) sessionStorage.setItem("bitneverse-hub", "1"); } catch (e) {}

  function isStandalone() {
    return (window.matchMedia && (matchMedia("(display-mode: standalone)").matches ||
      matchMedia("(display-mode: minimal-ui)").matches || matchMedia("(display-mode: fullscreen)").matches)) ||
      window.navigator.standalone === true;
  }

  function buildFilledCard(slot, appEntry) {
    var a = document.createElement("a");
    a.className = "card";
    a.setAttribute("data-app", appEntry.id);
    a.setAttribute("data-slot-id", slot.id);
    a.style.setProperty("--accent", appEntry.accent);
    a.style.setProperty("--accent-2", appEntry.accent2);
    a.href = buildAppUrl(appEntry, session);
    // Nameščen hub (standalone): aplikacija je izven njegovega obsega, zato bi se v
    // istem oknu odprla z vrstico brskalnika. V novem oknu jo Android preda nameščeni
    // aplikaciji (če obstaja), sicer odpre zavihek brskalnika. V brskalniku ostane isti zavihek.
    // Aplikacije na istem izvoru (zig4to.github.io) so v obsegu nameščene plošče
    // (manifest scope "../") → odprejo se v istem oknu brez vrstice; nazaj vodi hub-back.js.
    if (isStandalone() && !inHubScope(a.href)) {
      a.target = "_blank";
      a.rel = "noopener";
    }
    probeUrls(appEntry);

    var icon = document.createElement("span");
    icon.className = "card-icon";
    icon.innerHTML = appEntry.icon;

    var body = document.createElement("span");
    body.className = "card-body";
    var title = document.createElement("span");
    title.className = "card-title";
    title.textContent = appEntry.title;
    var sub = document.createElement("span");
    sub.className = "card-sub";
    sub.textContent = appEntry.subtitle;
    body.appendChild(title);
    body.appendChild(sub);

    var arrow = document.createElement("span");
    arrow.className = "card-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.innerHTML = ARROW_SVG;

    a.appendChild(icon);
    a.appendChild(body);
    a.appendChild(arrow);
    if (isFeatured(appEntry.id)) {
      var badge = document.createElement("span");
      badge.className = "badge-new badge-new--card";
      badge.textContent = "NOVO";
      a.appendChild(badge);
    }
    return a;
  }

  function buildEmptyCard(slot) {
    var div = document.createElement("div");
    div.className = "card card--empty";
    div.setAttribute("data-slot-id", slot.id);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-add-btn";
    btn.setAttribute("aria-label", "Dodaj aplikacijo");
    btn.innerHTML = PLUS_SVG;
    btn.addEventListener("click", function () {
      if (jeUrejanje()) return;
      openPicker(slot.id);
    });

    div.appendChild(btn);
    return div;
  }

  function canUse(appId) {
    var entry = APPS_BY_ID[appId];
    // adminOnly zahteva potrjenega admina — tudi ko my_access() ni na voljo
    if (entry && entry.adminOnly) return !!(access && access.is_admin && !access.blocked);
    if (!access) return true;
    if (access.blocked) return false;
    return access.is_admin || access.apps.indexOf(appId) !== -1;
  }

  function render() {
    grid.innerHTML = "";
    renderFeatured();
    if (access && access.blocked) {
      var msg = document.createElement("p");
      msg.className = "grid-blocked";
      msg.textContent = "Tvoj račun je onemogočen. Za pomoč se obrni na administratorja.";
      grid.appendChild(msg);
      return;
    }
    slots
      .slice()
      .sort(function (a, b) { return a.position - b.position; })
      .forEach(function (slot) {
        // Aplikacija brez dostopa (admin jo je odvzel) se prikaže kot prazno
        // mesto; v bazi ostane, da se vrne, če admin dostop spet dodeli.
        var appEntry = slot.app_id && canUse(slot.app_id) ? APPS_BY_ID[slot.app_id] : null;
        var card = appEntry ? buildFilledCard(slot, appEntry) : buildEmptyCard(slot);
        grid.appendChild(card);
      });
    ensureEditControls();
    // render() zbriše in ponovno zgradi celotno mrežo (grid.innerHTML = "")
    // — če smo bili sredi urejanja, se gumb "Končaj urejanje" izgubi skupaj
    // z ostalim; tu ga po potrebi takoj obnovimo.
    if (toggleEndCap && jeUrejanje()) toggleEndCap(true);
  }

  /* ---------- Supabase: nalaganje / prva prijava ---------- */

  function setAccess(a) {
    access = a;
    window.PTOMSETU_ACCESS = a;
    // Povezava na admin.html v meniju kroga — samo za admine (prava zaščita
    // so admin_* funkcije v bazi, ki preverijo is_admin()).
    var adminLink = document.getElementById("adminOpenBtn");
    if (adminLink) adminLink.hidden = !(a && a.is_admin && !a.blocked);
    document.dispatchEvent(new CustomEvent("ptomsetu:access", { detail: a }));
  }

  function fetchAccess() {
    var forUser = session && session.user.id;
    window.sb
      .rpc("my_access")
      .then(function (res) {
        if (!session || session.user.id !== forUser) return;
        // Napaka (npr. 005_admin.sql še ni zagnan) → vse dovoljeno.
        var d = res.error ? null : res.data;
        var a = d ? { is_admin: !!d.is_admin, blocked: !!d.blocked, apps: d.apps || [] } : null;
        try { localStorage.setItem(cacheKey + "-access", JSON.stringify(a)); } catch (e) {}
        setAccess(a);
        render();
      })
      .catch(function () {});
  }

  function loadSlots() {
    try { access = JSON.parse(localStorage.getItem(cacheKey + "-access")); } catch (e) { access = null; }
    if (access) setAccess(access);
    var cached = loadCache();
    if (cached && cached.length) {
      slots = cached;
      render();
    }
    fetchAccess();
    fetchSlots();
  }

  function fetchSlots() {
    window.sb
      .from("user_dashboard_slots")
      .select("id, app_id, position")
      // eksplicitni filter poleg RLS — obramba v globino, ne edina zaščita
      .eq("user_id", session.user.id)
      .order("position", { ascending: true })
      .then(function (res) {
        if (res.error) {
          showToast("Nalaganje ni uspelo. Preveri povezavo in poskusi znova.");
          return;
        }
        if (res.data && res.data.length) {
          slots = res.data;
          render();
          saveCache();
          ensureEmptySlotAvailable();
          return;
        }
        // Prva prijava: ni še vrstic — ustvari privzetih 6 mest (prva
        // zasedena z DEFAULT_APP_IDS, ostala prazna).
        // POZOR: namerno navaden insert, ne upsert z onConflict — unikatna
        // omejitev (user_id, position) je "deferrable" (zaradi vlečenja
        // razporeda spodaj), Postgres pa odložene omejitve ne dovoli kot cilj
        // za ON CONFLICT (klic bi tiho spodletel za vsakega novega uporabnika).
        var defaultApps = DEFAULT_APP_IDS.filter(function (id) { return APPS_BY_ID[id]; });
        var defaults = [];
        for (var i = 0; i < DEFAULT_SLOT_COUNT; i++) {
          defaults.push({ user_id: session.user.id, app_id: defaultApps[i] || null, position: i });
        }
        window.sb
          .from("user_dashboard_slots")
          .insert(defaults)
          .select("id, app_id, position")
          .then(function (insertRes) {
            if (insertRes.error) {
              showToast("Ustvarjanje nadzorne plošče ni uspelo.");
              return;
            }
            slots = insertRes.data || [];
            render();
            saveCache();
          })
          .catch(function () { showToast("Ustvarjanje nadzorne plošče ni uspelo. Preveri povezavo."); });
      })
      .catch(function () {
        showToast("Nalaganje ni uspelo. Preveri internetno povezavo.");
      });
  }

  /* ---------- Dodajanje praznega mesta (ročno in samodejno) ---------- */

  function addEmptySlot(onDone) {
    var nextPosition = slots.length
      ? Math.max.apply(null, slots.map(function (s) { return s.position; })) + 1
      : 0;
    window.sb
      .from("user_dashboard_slots")
      .insert({ user_id: session.user.id, app_id: null, position: nextPosition })
      .select("id, app_id, position")
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) {
          if (onDone) onDone(false);
          return;
        }
        slots.push(res.data[0]);
        render();
        saveCache();
        if (onDone) onDone(true);
      })
      .catch(function () { if (onDone) onDone(false); });
  }

  // Ko ni več nobenega praznega "+" mesta (vsa so zapolnjena z aplikacijo),
  // samodejno dodaj novo prazno mesto — uporabniku ni treba ročno klikati
  // "Dodaj mesto" vsakič, ko zapolni zadnjo prazno kartico.
  function ensureEmptySlotAvailable() {
    var hasEmpty = slots.some(function (s) { return !s.app_id; });
    if (hasEmpty) return;
    addEmptySlot();
  }

  /* ---------- Dodelitev / odstranitev aplikacije ---------- */

  function findSlot(slotId) {
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].id === slotId) return slots[i];
    }
    return null;
  }

  function assignApp(slotId, appId) {
    var slot = findSlot(slotId);
    if (!slot) return;
    var previous = slot.app_id;
    slot.app_id = appId;
    render();
    saveCache();
    if (appId) ensureEmptySlotAvailable();

    window.sb
      .from("user_dashboard_slots")
      .update({ app_id: appId, updated_at: new Date().toISOString() })
      .eq("id", slotId)
      .eq("user_id", session.user.id)
      .then(function (res) {
        if (res.error) {
          slot.app_id = previous;
          render();
          saveCache();
          showToast("Shranjevanje ni uspelo. Poskusi znova.");
        }
      })
      .catch(function () {
        slot.app_id = previous;
        render();
        saveCache();
        showToast("Shranjevanje ni uspelo. Preveri internetno povezavo.");
      });
  }

  function unassignApp(slotId) {
    assignApp(slotId, null);
  }

  function deleteSlot(slotId) {
    var slot = findSlot(slotId);
    if (!slot) return;
    var idx = slots.indexOf(slot);
    slots.splice(idx, 1);
    render();
    saveCache();

    window.sb
      .from("user_dashboard_slots")
      .delete()
      .eq("id", slotId)
      .eq("user_id", session.user.id)
      .then(function (res) {
        if (res.error) {
          slots.splice(idx, 0, slot);
          render();
          saveCache();
          showToast("Brisanje mesta ni uspelo. Poskusi znova.");
        }
      })
      .catch(function () {
        slots.splice(idx, 0, slot);
        render();
        saveCache();
        showToast("Brisanje mesta ni uspelo. Preveri internetno povezavo.");
      });
  }

  /* ---------- Izbirnik aplikacij ("+" modal) ---------- */

  var modal = document.getElementById("appPickerModal");
  var modalList = document.getElementById("appPickerList");
  var modalClose = document.getElementById("appPickerClose");
  var activeSlotId = null;

  function renderPicker() {
    if (!modalList) return;
    modalList.innerHTML = "";
    APPS.forEach(function (app) {
      if (!canUse(app.id)) return;
      var taken = slots.some(function (s) { return s.app_id === app.id && canUse(s.app_id); });

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "modal-app-option" + (taken ? " is-taken" : "");
      btn.disabled = taken;
      btn.style.setProperty("--accent", app.accent);
      btn.style.setProperty("--accent-2", app.accent2);

      var icon = document.createElement("span");
      icon.className = "card-icon";
      icon.innerHTML = app.icon;

      var title = document.createElement("span");
      title.className = "modal-app-title";
      title.textContent = app.title;

      btn.appendChild(icon);
      btn.appendChild(title);

      if (taken) {
        var badge = document.createElement("span");
        badge.className = "modal-app-badge";
        badge.textContent = "Že dodano";
        btn.appendChild(badge);
      } else {
        btn.addEventListener("click", function () {
          assignApp(activeSlotId, app.id);
          closePicker();
          if (window.ptomsetuInstall) {
            window.ptomsetuInstall.maybeShowPromo("dashboard-add");
          }
        });
      }

      modalList.appendChild(btn);
    });
  }

  function openPicker(slotId) {
    activeSlotId = slotId;
    if (!modal) return;
    renderPicker();
    modal.hidden = false;
  }

  function closePicker() {
    activeSlotId = null;
    if (modal) modal.hidden = true;
  }

  if (modalClose) modalClose.addEventListener("click", closePicker);
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closePicker();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal && !modal.hidden) closePicker();
  });

  /* ---------- "Dodaj mesto" ---------- */

  var addSlotBtn = document.getElementById("addSlotBtn");
  if (addSlotBtn) {
    addSlotBtn.addEventListener("click", function () {
      addSlotBtn.disabled = true;
      addEmptySlot(function (ok) {
        addSlotBtn.disabled = false;
        if (!ok) showToast("Dodajanje mesta ni uspelo. Poskusi znova.");
      });
    });
  }

  /* ---------- Ročaji za urejanje: vlečenje + odstranitev ---------- */

  function ensureEditControls() {
    var cards = grid.querySelectorAll(".card");
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (!card.querySelector(".card-grip")) {
        var grip = document.createElement("span");
        grip.className = "card-grip";
        grip.setAttribute("aria-hidden", "true");
        grip.setAttribute("title", "Povleci za premik");
        grip.innerHTML = GRIP_ICON;
        card.appendChild(grip);
      }
      var isEmpty = card.classList.contains("card--empty");
      if (!card.querySelector(".card-remove")) {
        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "card-remove";
        remove.setAttribute("aria-label", isEmpty ? "Izbriši prazno mesto" : "Odstrani aplikacijo s tega mesta");
        remove.setAttribute("title", isEmpty ? "Izbriši mesto" : "Odstrani s tega mesta");
        remove.innerHTML = REMOVE_ICON;
        remove.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          var cardEl = e.currentTarget.closest(".card");
          var slotId = cardEl.getAttribute("data-slot-id");
          if (cardEl.classList.contains("card--empty")) deleteSlot(slotId);
          else unassignApp(slotId);
        });
        card.appendChild(remove);
      }
    }
  }

  /* ---------- Vlečenje razvrščanja (prirejeno iz prejšnjega app.js) ---------- */

  var reorderBtn = document.getElementById("reorderBtn");
  var reorderLabel = document.getElementById("reorderLabel");

  if (reorderBtn && reorderLabel) {
    var saveOrderTimer = null;

    var saveOrder = function () {
      var cards = grid.querySelectorAll(".card");
      for (var i = 0; i < cards.length; i++) {
        var slot = findSlot(cards[i].getAttribute("data-slot-id"));
        if (slot) slot.position = i;
      }
      saveCache();

      clearTimeout(saveOrderTimer);
      saveOrderTimer = setTimeout(function () {
        var rows = slots.map(function (s) {
          return {
            id: s.id,
            user_id: session.user.id,
            app_id: s.app_id,
            position: s.position,
            updated_at: new Date().toISOString()
          };
        });
        window.sb
          .from("user_dashboard_slots")
          .upsert(rows)
          .then(function (res) {
            if (res.error) showToast("Shranjevanje razporeda ni uspelo.");
          })
          .catch(function () { showToast("Shranjevanje razporeda ni uspelo. Preveri povezavo."); });
      }, 400);
    };

    // Gumb "Končaj urejanje" na koncu mreže (za zadnjo "+" kartico) — enak
    // učinek kot klik na "Uredi razpored" v meniju, le da je na dosegu roke
    // med samim urejanjem. Ni razred ".card", ker se izogiba vsej logiki
    // vlečenja/shranjevanja spodaj (querySelectorAll(".card") ga ne zajame).
    toggleEndCap = function (on) {
      var existing = document.getElementById("gridEndCap");
      if (on) {
        if (existing) return;
        var el = document.createElement("button");
        el.type = "button";
        el.id = "gridEndCap";
        el.className = "card--end-action";
        el.innerHTML =
          '<span class="card-end-icon">' + CHECK_SVG + "</span>" +
          '<span class="card-end-label">Končaj urejanje</span>';
        el.addEventListener("click", function () { setReorder(false); });
        grid.appendChild(el);
      } else if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
    };

    var setReorder = function (on) {
      document.body.classList.toggle("is-reordering", on);
      reorderBtn.setAttribute("aria-pressed", String(on));
      reorderLabel.textContent = on ? "Končaj urejanje" : "Uredi razpored";
      toggleEndCap(on);
      if (!on) { endDrag(); saveOrder(); }
    };

    reorderBtn.addEventListener("click", function () {
      setReorder(reorderBtn.getAttribute("aria-pressed") !== "true");
      if (window.ptomsetuCloseAvatarPopover) window.ptomsetuCloseAvatarPopover();
    });

    // Med urejanjem klik na kartico ne sme odpreti aplikacije.
    grid.addEventListener("click", function (e) {
      if (!jeUrejanje()) return;
      var c = e.target.closest ? e.target.closest(".card") : null;
      if (c && !e.target.closest(".card-remove")) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    grid.addEventListener("dragstart", function (e) {
      if (jeUrejanje()) e.preventDefault();
    });

    var drag = null;
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

      var grip = e.target.closest ? e.target.closest(".card-grip") : null;
      if (!grip) return;
      var card = grip.closest(".card");
      if (!card || card.parentNode !== grid) return;

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

  /* ---------- Vklop / izklop ob prijavi / odjavi ---------- */

  function handleSignedIn(sess) {
    session = sess;
    cacheKey = "ptomsetu-dashboard-cache-" + session.user.id;
    var addSlot = document.getElementById("addSlotBtn");
    if (addSlot) addSlot.hidden = false;
    loadSlots();
  }

  function handleSignedOut() {
    if (cacheKey) {
      try { localStorage.removeItem(cacheKey); } catch (e) {}
    }
    if (cacheKey) {
      try { localStorage.removeItem(cacheKey + "-access"); } catch (e) {}
    }
    session = null;
    cacheKey = null;
    setAccess(null);
    slots = [];
    grid.innerHTML = "";
    if (featuredEl) { featuredEl.innerHTML = ""; featuredEl.hidden = true; }
    closePicker();
  }

  document.addEventListener("ptomsetu:signed-in", function (e) { handleSignedIn(e.detail.session); });
  document.addEventListener("ptomsetu:signed-out", handleSignedOut);

  // Dohitevalni preklop: auth.js seje včasih razreši (in dogodek sproži) že
  // med lastnim izvajanjem, še preden brskalnik sploh začne izvajati TO
  // datoteko (mikro-opravila se izvedejo med posameznimi <script> značkami)
  // — takrat tu zgoraj registriran poslušalec zamudi dogodek. Če je seja v
  // tem trenutku že na voljo globalno, jo takoj uporabimo namesto čakanja.
  if (window.PTOMSETU_SESSION) {
    handleSignedIn(window.PTOMSETU_SESSION);
  }
})();

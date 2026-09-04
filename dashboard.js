/* TomStudios — osebna nadzorna plošča.
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
  var slots = [];          // { id, app_id, position }
  var session = null;
  var cacheKey = null;

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

  /* ---------- Pomožno ---------- */

  function jeUrejanje() {
    return document.body.classList.contains("is-reordering");
  }

  function buildAppUrl(appEntry, sess) {
    var url;
    try {
      url = new URL(appEntry.url);
    } catch (e) {
      return appEntry.url;
    }
    if (sess && sess.access_token && sess.refresh_token) {
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

  function buildFilledCard(slot, appEntry) {
    var a = document.createElement("a");
    a.className = "card";
    a.setAttribute("data-app", appEntry.id);
    a.setAttribute("data-slot-id", slot.id);
    a.style.setProperty("--accent", appEntry.accent);
    a.style.setProperty("--accent-2", appEntry.accent2);
    a.href = buildAppUrl(appEntry, session);

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

  function render() {
    grid.innerHTML = "";
    slots
      .slice()
      .sort(function (a, b) { return a.position - b.position; })
      .forEach(function (slot) {
        var appEntry = slot.app_id ? APPS_BY_ID[slot.app_id] : null;
        var card = appEntry ? buildFilledCard(slot, appEntry) : buildEmptyCard(slot);
        grid.appendChild(card);
      });
    ensureEditControls();
  }

  /* ---------- Supabase: nalaganje / prva prijava ---------- */

  function loadSlots() {
    var cached = loadCache();
    if (cached && cached.length) {
      slots = cached;
      render();
    }

    window.sb
      .from("user_dashboard_slots")
      .select("id, app_id, position")
      // eksplicitni filter poleg RLS — obramba v globino, ne edina zaščita
      .eq("user_id", session.user.id)
      .order("position", { ascending: true })
      .then(function (res) {
        if (res.error) { showToast("Nalaganje ni uspelo. Poskusi osvežiti stran."); return; }
        if (res.data && res.data.length) {
          slots = res.data;
          render();
          saveCache();
          return;
        }
        // Prva prijava: ni še vrstic — ustvari privzetih 6 praznih mest.
        var defaults = [];
        for (var i = 0; i < DEFAULT_SLOT_COUNT; i++) {
          defaults.push({ user_id: session.user.id, app_id: null, position: i });
        }
        window.sb
          .from("user_dashboard_slots")
          .insert(defaults)
          .select("id, app_id, position")
          .then(function (insertRes) {
            if (insertRes.error) { showToast("Ustvarjanje nadzorne plošče ni uspelo."); return; }
            slots = insertRes.data || [];
            render();
            saveCache();
          });
      });
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
      });
  }

  function unassignApp(slotId) {
    assignApp(slotId, null);
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
      var taken = slots.some(function (s) { return s.app_id === app.id; });

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
      var nextPosition = slots.length
        ? Math.max.apply(null, slots.map(function (s) { return s.position; })) + 1
        : 0;
      addSlotBtn.disabled = true;
      window.sb
        .from("user_dashboard_slots")
        .insert({ user_id: session.user.id, app_id: null, position: nextPosition })
        .select("id, app_id, position")
        .then(function (res) {
          addSlotBtn.disabled = false;
          if (res.error || !res.data || !res.data.length) {
            showToast("Dodajanje mesta ni uspelo. Poskusi znova.");
            return;
          }
          slots.push(res.data[0]);
          render();
          saveCache();
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
      if (!isEmpty && !card.querySelector(".card-remove")) {
        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "card-remove";
        remove.setAttribute("aria-label", "Odstrani aplikacijo s tega mesta");
        remove.setAttribute("title", "Odstrani s tega mesta");
        remove.innerHTML = REMOVE_ICON;
        remove.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          var slotId = e.currentTarget.closest(".card").getAttribute("data-slot-id");
          unassignApp(slotId);
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
          });
      }, 400);
    };

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

  document.addEventListener("ptomsetu:signed-in", function (e) {
    session = e.detail.session;
    cacheKey = "ptomsetu-dashboard-cache-" + session.user.id;
    var addSlot = document.getElementById("addSlotBtn");
    if (addSlot) addSlot.hidden = false;
    loadSlots();
  });

  document.addEventListener("ptomsetu:signed-out", function () {
    if (cacheKey) {
      try { localStorage.removeItem(cacheKey); } catch (e) {}
    }
    session = null;
    cacheKey = null;
    slots = [];
    grid.innerHTML = "";
    closePicker();
  });
})();

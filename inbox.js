/* Šeri — prejete datoteke na vrhu plošče (pod glavo).
   Ob prijavi naloži nepotekle prenose zame in se naroči na Realtime INSERT,
   da se nova datoteka pokaže takoj. Prenesi = podpisan URL z izvirnim imenom. */
(function () {
  "use strict";

  var S = window.SERI;
  var box = document.getElementById("seriInbox");
  var badge = document.getElementById("seriBadge");
  if (!S || !box) return;

  var uid = null;
  var items = [];
  var names = {};
  var channel = null;
  var tick = null;

  function sb() { return window.sb; }

  var DL_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
  var EYE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>';
  var X_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  function hoursLeft(t) {
    var ms = Date.parse(t.expires_at) - Date.now();
    if (ms <= 0) return "poteklo";
    var h = Math.floor(ms / 3600000);
    if (h >= 1) return "še " + h + " h";
    return "še " + Math.max(1, Math.ceil(ms / 60000)) + " min";
  }

  function senderLabel(t) {
    if (t.sender_id === uid) return t._arrive ? "Prihaja s tvoje druge naprave" : "S tvoje druge naprave";
    var n = (names[t.sender_id] || "Nekdo").split(/\s+/)[0];
    return n + (t._arrive ? " ti pošilja" : " ti je poslal");
  }

  function updateBadge() {
    if (!badge) return;
    var n = items.filter(function (t) { return !t.downloaded_at; }).length;
    badge.textContent = n > 9 ? "9+" : String(n);
    badge.hidden = n === 0;
  }

  function render() {
    var now = Date.now();
    items = items.filter(function (t) { return Date.parse(t.expires_at) > now; });
    box.innerHTML = "";
    box.hidden = items.length === 0;
    items.forEach(function (t) { box.appendChild(card(t)); });
    updateBadge();
  }

  function card(t) {
    var el = document.createElement("article");
    el.className = "seri-in" + (t.downloaded_at ? " is-done" : "") + (t._new ? " is-new" : "") +
      (t._arrive ? " is-arriving" : "") + (t._landed ? " is-landed" : "");
    el.setAttribute("data-id", t.id);
    t._new = false;
    t._landed = false;
    var c = S.kindColors(t.name, t.mime);
    el.style.setProperty("--doc-a", c[0]);
    el.style.setProperty("--doc-b", c[1]);

    var icon = document.createElement("span");
    icon.className = "seri-in-icon";
    icon.textContent = (S.ext(t.name) || "file").slice(0, 4).toUpperCase();

    var body = document.createElement("div");
    body.className = "seri-in-body";
    var from = document.createElement("span");
    from.className = "seri-in-from";
    from.textContent = senderLabel(t);
    var name = document.createElement("span");
    name.className = "seri-in-name";
    name.textContent = t.name;
    name.title = t.name;
    var meta = document.createElement("span");
    meta.className = "seri-in-meta";
    meta.textContent = S.formatSize(Number(t.size) || 0) + " · " + hoursLeft(t);
    body.appendChild(from);
    body.appendChild(name);
    body.appendChild(meta);
    if (t._arrive) {
      var bar = document.createElement("div");
      bar.className = "seri-in-bar";
      bar.innerHTML = "<span></span><em></em>";
      bar.firstChild.style.width = (t._pct || 0) + "%";
      bar.lastChild.textContent = Math.round(t._pct || 0) + " %";
      body.appendChild(bar);
    }

    var dl = document.createElement("button");
    dl.type = "button";
    dl.className = "seri-in-dl";
    dl.innerHTML = DL_ICON + "<span>" + (t.downloaded_at ? "Znova" : "Prenesi") + "</span>";
    dl.addEventListener("click", function () { download(t, dl); });

    var rm = document.createElement("button");
    rm.type = "button";
    rm.className = "seri-in-x";
    rm.setAttribute("aria-label", "Odstrani");
    rm.innerHTML = X_ICON;
    rm.addEventListener("click", function () { remove(t, el); });

    el.appendChild(icon);
    el.appendChild(body);
    if (isImage(t)) {
      var eye = document.createElement("button");
      eye.type = "button";
      eye.className = "seri-in-eye";
      eye.setAttribute("aria-label", "Predogled slike");
      eye.title = "Predogled";
      eye.innerHTML = EYE_ICON;
      eye.addEventListener("click", function () { preview(t, eye); });
      el.appendChild(eye);
    }
    el.appendChild(dl);
    el.appendChild(rm);
    return el;
  }

  function download(t, btn) {
    btn.disabled = true;
    sb().storage.from(S.BUCKET).createSignedUrl(t.path, 600, { download: t.name })
      .then(function (res) {
        btn.disabled = false;
        if (res.error || !res.data) { alertFail(); return; }
        var a = document.createElement("a");
        a.href = res.data.signedUrl;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (!t.downloaded_at) {
          t.downloaded_at = new Date().toISOString();
          render();
          sb().from("seri_transfers").update({ downloaded_at: t.downloaded_at }).eq("id", t.id).then(function () {});
        }
      });
  }

  /* ---------- Predogled slike ---------- */
  var IMG_EXT = /^(jpe?g|png|gif|webp|avif|svg|bmp|heic|heif)$/;
  function isImage(t) {
    return /^image\//.test(t.mime || "") || IMG_EXT.test(S.ext(t.name));
  }

  var lightbox = null;
  function closePreview() {
    if (!lightbox) return;
    var lb = lightbox;
    lightbox = null;
    lb.classList.remove("is-open");
    document.removeEventListener("keydown", onPreviewKey);
    setTimeout(function () { lb.remove(); }, 220);
  }
  function onPreviewKey(e) { if (e.key === "Escape") closePreview(); }

  function preview(t, btn) {
    if (lightbox) closePreview();
    btn.disabled = true;
    // brez {download}: brskalnik sliko prikaže; predogled ne šteje kot prenos
    sb().storage.from(S.BUCKET).createSignedUrl(t.path, 600).then(function (res) {
      btn.disabled = false;
      if (res.error || !res.data) { alertFail(); return; }

      var lb = document.createElement("div");
      lb.className = "seri-lightbox";
      lb.setAttribute("role", "dialog");
      lb.setAttribute("aria-modal", "true");
      lb.setAttribute("aria-label", "Predogled: " + t.name);

      var fig = document.createElement("figure");
      fig.className = "seri-lightbox-fig";
      var spinner = document.createElement("span");
      spinner.className = "seri-lightbox-spin";
      var img = document.createElement("img");
      img.alt = t.name;
      img.decoding = "async";
      img.onload = function () { spinner.remove(); fig.classList.add("is-loaded"); };
      img.onerror = function () {
        spinner.remove();
        img.remove();
        var p = document.createElement("p");
        p.className = "seri-lightbox-err";
        p.textContent = "Te vrste slike brskalnik ne zna prikazati. Prenesi jo.";
        fig.insertBefore(p, cap);
      };
      img.src = res.data.signedUrl;

      var cap = document.createElement("figcaption");
      var nm = document.createElement("span");
      nm.textContent = t.name;
      var get = document.createElement("button");
      get.type = "button";
      get.className = "seri-in-dl";
      get.style.setProperty("--doc-a", S.kindColors(t.name, t.mime)[0]);
      get.style.setProperty("--doc-b", S.kindColors(t.name, t.mime)[1]);
      get.innerHTML = DL_ICON + "<span>Prenesi</span>";
      get.addEventListener("click", function (e) { e.stopPropagation(); download(t, get); });
      cap.appendChild(nm);
      cap.appendChild(get);

      var close = document.createElement("button");
      close.type = "button";
      close.className = "seri-lightbox-x";
      close.setAttribute("aria-label", "Zapri predogled");
      close.innerHTML = X_ICON;
      close.addEventListener("click", closePreview);

      fig.appendChild(spinner);
      fig.appendChild(img);
      fig.appendChild(cap);
      lb.appendChild(fig);
      lb.appendChild(close);
      // klik na ozadje zapre, klik na sliko/napis ne
      lb.addEventListener("click", function (e) { if (e.target === lb || e.target === fig) closePreview(); });
      document.body.appendChild(lb);
      document.addEventListener("keydown", onPreviewKey);
      lightbox = lb;
      requestAnimationFrame(function () { lb.classList.add("is-open"); close.focus(); });
    });
  }

  function alertFail() {
    var t = document.querySelector(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = "Datoteke ni bilo mogoče prenesti (morda je potekla).";
    t.classList.add("is-visible");
    setTimeout(function () { t.classList.remove("is-visible"); }, 3200);
  }

  function remove(t, el) {
    el.classList.add("is-leaving");
    setTimeout(function () {
      items = items.filter(function (x) { return x.id !== t.id; });
      render();
    }, 260);
    // najprej datoteka (pravico daje vrstica), nato vrstica
    sb().storage.from(S.BUCKET).remove([t.path])
      .then(function () { return sb().from("seri_transfers").delete().eq("id", t.id); })
      .catch(function () {});
  }

  // Ikona se sestavi iz delcev (zrcalno pošiljateljevemu razpadu). Če je plošča
  // v ozadju, počakaj, da jo odpreš — sicer bi animacija „pretekla“ neopažena.
  function arrive(t) {
    if (document.hidden) {
      var wait = function () {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", wait);
        arrive(t);
      };
      document.addEventListener("visibilitychange", wait);
      return;
    }
    var sel = function (q) { return box.querySelector('.seri-in[data-id="' + t.id + '"] ' + q); };
    S.transfer({
      icon: S.makeIcon(t.name, t.mime),
      mode: "in",
      rect: function () { var el = sel(".seri-in-icon"); return el ? el.getBoundingClientRect() : null; },
      point: function () { return { x: innerWidth / 2, y: -40 }; },
      onProgress: function (k) {
        t._pct = k * 100;
        var bar = sel(".seri-in-bar");
        if (bar) {
          bar.firstChild.style.width = t._pct + "%";
          bar.lastChild.textContent = Math.round(t._pct) + " %";
        }
      },
      onDone: function () {
        if (!t._arrive) return;
        t._arrive = false;
        t._landed = true;
        render();
      }
    });
  }

  function loadNames() {
    return sb().rpc("seri_users").then(function (res) {
      (res.data || []).forEach(function (u) { names[u.id] = u.name; });
    });
  }

  function load() {
    return sb().from("seri_transfers")
      .select("id, sender_id, recipient_id, path, name, size, mime, created_at, downloaded_at, expires_at")
      .eq("recipient_id", uid)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .then(function (res) {
        if (res.error) return; // tabela še ne obstaja → tiho
        items = res.data || [];
        render();
      });
  }

  function subscribe() {
    channel = sb().channel("seri-inbox-" + uid)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "seri_transfers", filter: "recipient_id=eq." + uid },
        function (payload) {
          var t = payload.new;
          if (!t || items.some(function (x) { return x.id === t.id; })) return;
          t._new = true;
          t._arrive = true;
          t._pct = 0;
          var show = function () { items.unshift(t); render(); arrive(t); };
          if (t.sender_id !== uid && !names[t.sender_id]) loadNames().then(show, show);
          else show();
        })
      .on("postgres_changes",
        { event: "DELETE", schema: "public", table: "seri_transfers" },
        function (payload) {
          var id = payload.old && payload.old.id;
          if (!id) return;
          var before = items.length;
          items = items.filter(function (x) { return x.id !== id; });
          if (items.length !== before) render();
        })
      .subscribe();
  }

  function stop() {
    if (channel && sb()) sb().removeChannel(channel);
    channel = null;
    clearInterval(tick);
    tick = null;
    uid = null;
    items = [];
    render();
  }

  function startFor(session) {
    if (!session || !session.user || !window.sb) return;
    if (uid === session.user.id) return;
    if (uid) stop();
    uid = session.user.id;
    loadNames().then(load, load).then(function () {
      if (uid) subscribe();
    });
    S.cleanup(sb(), uid);
    // osveži „še N h“ in odstrani potekle
    tick = setInterval(function () { if (items.length) render(); }, 60000);
  }

  document.addEventListener("ptomsetu:signed-in", function (e) { startFor(e.detail && e.detail.session); });
  document.addEventListener("ptomsetu:signed-out", stop);
  if (window.PTOMSETU_SESSION) startFor(window.PTOMSETU_SESSION);
})();

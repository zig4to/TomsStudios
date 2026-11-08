/* Klepet na plošči: mini klepet pod glavo (zadnja sporočila v živo + hiter
   odgovor) in značka neprebranih na gumbu Klepet. Cel klepet je chat.html. */
(function () {
  "use strict";

  var S = window.SERI;
  var box = document.getElementById("chatMini");
  var badge = document.getElementById("chatBadge");
  if (!S || !box) return;

  var SHOW = 3;          // strnjeno na plošči
  var SHOW_FULL = 50;    // razširjeno čez cel zaslon
  var expanded = false;
  var COLLAPSE_KEY = "chat-mini-collapsed";
  var MSG_COLS = "id, sender_id, body, file_path, file_name, file_mime, created_at";

  var uid = null;
  var names = {};
  var msgs = [];          // zadnja sporočila, naraščajoče
  var lastRead = null;    // ISO
  var unread = 0;
  var channel = null;
  var ready = false;

  function sb() { return window.sb; }

  function collapsed() {
    try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch (e) { return false; }
  }
  function setCollapsed(v) {
    try { localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0"); } catch (e) {}
  }

  function firstName(id) {
    if (id === uid) return "Ti";
    return (names[id] || "Nekdo").split(/\s+/)[0];
  }

  function preview(m) {
    if (m._failed) return "⚠️ Ni poslano: " + (m.file_name || m.body || "");
    if (m._pending && m.file_path) return "⏳ " + m.file_name + " · " + Math.round(m._pct || 0) + " %";
    if (m.file_path) {
      var kind = S.isImage(m.file_name, m.file_mime) ? "🖼️ Slika" : "📎 " + m.file_name;
      return m.body ? kind + " · " + m.body : kind;
    }
    return m.body || "";
  }

  function ago(iso) {
    var s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 60) return "zdaj";
    if (s < 3600) return Math.floor(s / 60) + " min";
    if (s < 86400) return Math.floor(s / 3600) + " h";
    var d = new Date(iso);
    return d.getDate() + ". " + (d.getMonth() + 1) + ".";
  }

  /* ---------- Značka ---------- */

  function showBadge() {
    if (!badge) return;
    badge.textContent = unread > 9 ? "9+" : String(unread);
    badge.hidden = unread === 0;
  }

  function recount() {
    if (!uid) return;
    var me = uid;
    sb().from("chat_reads").select("last_read_at").eq("user_id", me).maybeSingle()
      .then(function (res) {
        if (res.error) return null;
        // še nikoli odprto → štej zadnjih 7 dni
        lastRead = (res.data && res.data.last_read_at) || new Date(Date.now() - 7 * 86400000).toISOString();
        return sb().from("chat_messages").select("id", { count: "exact", head: true })
          .gt("created_at", lastRead).neq("sender_id", me);
      })
      .then(function (res) {
        if (!res || res.error || uid !== me) return;
        unread = res.count || 0;
        showBadge();
        render();
      });
  }

  function markRead() {
    lastRead = new Date().toISOString();
    unread = 0;
    showBadge();
    sb().from("chat_reads").upsert({ user_id: uid, last_read_at: lastRead }).then(function () {});
  }

  /* ---------- Izris ---------- */

  var SEND_ICON =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>';
  var EXPAND_ICON =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>';
  var SHRINK_ICON =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg>';
  var CLIP_ICON =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
  var PHOTO_ICON =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/></svg>';
  var CHEV_ICON =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  var CHAT_ICON =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';

  var els = null;

  function build() {
    box.innerHTML = "";
    var head = document.createElement("div");
    head.className = "chat-mini-head";
    var title = document.createElement("a");
    title.className = "chat-mini-title";
    title.href = "chat.html";
    title.innerHTML = '<span class="chat-mini-mark">' + CHAT_ICON + "</span><strong>Klepet</strong>";
    var count = document.createElement("span");
    count.className = "chat-mini-count";
    title.appendChild(count);
    var tog = document.createElement("button");
    tog.type = "button";
    tog.className = "chat-mini-toggle";
    tog.innerHTML = CHEV_ICON;
    tog.addEventListener("click", function () {
      var c = !box.classList.contains("is-collapsed");
      box.classList.toggle("is-collapsed", c);
      setCollapsed(c);
      tog.setAttribute("aria-expanded", String(!c));
      tog.setAttribute("aria-label", c ? "Razširi klepet" : "Strni klepet");
    });
    var exp = document.createElement("button");
    exp.type = "button";
    exp.className = "chat-mini-expand";
    exp.innerHTML = EXPAND_ICON;
    exp.addEventListener("click", function () { setExpanded(!expanded); });
    var tools = document.createElement("div");
    tools.className = "chat-mini-tools";
    tools.appendChild(exp);
    tools.appendChild(tog);
    head.appendChild(title);
    head.appendChild(tools);

    // strnjeno: klik na sporočila odpre cel klepet; razširjeno: samo drsenje
    var list = document.createElement("div");
    list.className = "chat-mini-list";
    list.addEventListener("click", function () { if (!expanded) location.href = "chat.html"; });

    var form = document.createElement("form");
    form.className = "chat-mini-form";
    form.autocomplete = "off";
    var inp = document.createElement("input");
    inp.type = "text";
    inp.className = "chat-mini-input";
    inp.placeholder = "Napiši vsem …";
    inp.maxLength = 4000;
    inp.setAttribute("aria-label", "Sporočilo v klepet");
    inp.setAttribute("enterkeyhint", "send");
    var send = document.createElement("button");
    send.type = "submit";
    send.className = "chat-mini-send";
    send.setAttribute("aria-label", "Pošlji");
    send.innerHTML = SEND_ICON;
    send.disabled = true;
    inp.addEventListener("input", function () { send.disabled = !inp.value.trim(); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = inp.value.trim();
      if (!text) return;
      inp.value = "";
      send.disabled = true;
      quickSend(text);
    });
    // priponke: datoteka (vsi formati) in galerija (izbirnik fotografij)
    var fileInp = document.createElement("input");
    fileInp.type = "file";
    fileInp.multiple = true;
    fileInp.hidden = true;
    var galInp = document.createElement("input");
    galInp.type = "file";
    galInp.accept = "image/*,video/*";
    galInp.multiple = true;
    galInp.hidden = true;
    [fileInp, galInp].forEach(function (fi) {
      fi.addEventListener("change", function () {
        Array.prototype.slice.call(fi.files || [], 0, 10).forEach(sendFile);
        fi.value = "";
      });
    });
    var attach = document.createElement("button");
    attach.type = "button";
    attach.className = "chat-mini-attach";
    attach.setAttribute("aria-label", "Priloži datoteko");
    attach.title = "Datoteka";
    attach.innerHTML = CLIP_ICON;
    attach.addEventListener("click", function () { fileInp.click(); });
    var photo = document.createElement("button");
    photo.type = "button";
    photo.className = "chat-mini-attach chat-mini-photo";
    photo.setAttribute("aria-label", "Slika iz galerije");
    photo.title = "Galerija";
    photo.innerHTML = PHOTO_ICON;
    photo.addEventListener("click", function () { galInp.click(); });

    form.appendChild(attach);
    form.appendChild(photo);
    form.appendChild(inp);
    form.appendChild(send);
    form.appendChild(fileInp);
    form.appendChild(galInp);

    box.appendChild(head);
    box.appendChild(list);
    box.appendChild(form);

    var c = collapsed();
    box.classList.toggle("is-collapsed", c);
    tog.setAttribute("aria-expanded", String(!c));
    tog.setAttribute("aria-label", c ? "Razširi klepet" : "Strni klepet");
    els = { list: list, count: count, exp: exp, tog: tog, inp: inp };
    syncExpandBtn();
  }

  /* ---------- Razširitev čez cel zaslon ---------- */

  function syncExpandBtn() {
    if (!els) return;
    els.exp.innerHTML = expanded ? SHRINK_ICON : EXPAND_ICON;
    els.exp.setAttribute("aria-label", expanded ? "Pomanjšaj klepet" : "Razširi klepet čez cel zaslon");
    els.exp.title = expanded ? "Pomanjšaj" : "Čez cel zaslon";
    els.tog.hidden = expanded;
  }

  // višina = vidni del zaslona (tipkovnica na telefonu ne prekrije polja)
  function fit() {
    if (!expanded) return;
    var vv = window.visualViewport;
    box.style.height = Math.round(vv ? vv.height : window.innerHeight) + "px";
    box.style.top = Math.round(vv ? vv.offsetTop : 0) + "px";
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () { fit(); if (expanded) listToBottom(); });
    window.visualViewport.addEventListener("scroll", fit);
  }
  window.addEventListener("resize", fit);

  function listToBottom() {
    if (els) els.list.scrollTop = els.list.scrollHeight;
  }

  function setExpanded(v, fromHistory) {
    if (v === expanded || !els) return;
    expanded = v;
    if (v) {
      box.classList.remove("is-collapsed");
      box.classList.add("is-expanded");
      document.body.classList.add("chat-mini-open");
      fit();
      // sistemski „nazaj“ na telefonu zapre razširjen klepet
      if (!fromHistory) { try { history.pushState({ chatMini: 1 }, ""); } catch (e) {} }
    } else {
      box.classList.remove("is-expanded");
      document.body.classList.remove("chat-mini-open");
      box.style.height = "";
      box.style.top = "";
      box.classList.toggle("is-collapsed", collapsed());
      if (!fromHistory && history.state && history.state.chatMini) { try { history.back(); } catch (e) {} }
    }
    syncExpandBtn();
    render();
    if (v) listToBottom();
  }

  window.addEventListener("popstate", function () { if (expanded) setExpanded(false, true); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && expanded) setExpanded(false);
  });

  function render(animateId) {
    if (!els) return;
    els.list.innerHTML = "";
    els.count.textContent = unread ? unread + " novih" : "";
    els.count.hidden = !unread;
    var stick = expanded && els.list.scrollHeight - els.list.scrollTop - els.list.clientHeight < 80;
    var last = msgs.slice(-(expanded ? SHOW_FULL : SHOW));
    if (!last.length) {
      var empty = document.createElement("span");
      empty.className = "chat-mini-empty";
      empty.textContent = "Še tiho. Pozdravi vse v TomStudios 👋";
      els.list.appendChild(empty);
      return;
    }
    // Messenger: moja desno (preliv), ostala levo (siv oblaček + avatar);
    // zaporedna sporočila iste osebe združena (ime/avatar samo enkrat)
    last.forEach(function (m, i) {
      var me = m.sender_id === uid;
      var prev = last[i - 1], next = last[i + 1];
      var gPrev = prev && prev.sender_id === m.sender_id;
      var gNext = next && next.sender_id === m.sender_id;
      var isNew = lastRead && !me && m.created_at > lastRead;
      var row = document.createElement("div");
      row.className = "chat-mini-row" + (me ? " is-me" : "") + (isNew ? " is-unread" : "") +
        (m.id === animateId ? " is-new" : "") + (gPrev ? " is-gprev" : "") + (gNext ? " is-gnext" : "");
      if (!me) {
        var c = S.personColors(m.sender_id);
        var av = document.createElement("i");
        av.className = "chat-mini-av";
        av.style.background = "linear-gradient(140deg," + c[0] + "," + c[1] + ")";
        av.textContent = S.initials(names[m.sender_id] || "?").charAt(0);
        row.appendChild(av);
      }
      var col = document.createElement("div");
      col.className = "chat-mini-col";
      if (!me && !gPrev) {
        var who = document.createElement("b");
        who.textContent = firstName(m.sender_id);
        col.appendChild(who);
      }
      var bub = document.createElement("span");
      bub.className = "chat-mini-bub";
      bub.textContent = preview(m);
      bub.title = ago(m.created_at);
      col.appendChild(bub);
      if (!gNext) {
        var when = document.createElement("em");
        when.textContent = ago(m.created_at);
        col.appendChild(when);
      }
      row.appendChild(col);
      els.list.appendChild(row);
    });
    if (stick || (expanded && animateId)) listToBottom();
  }

  /* ---------- Podatki ---------- */

  function loadNames() {
    return sb().rpc("seri_users").then(function (res) {
      (res.data || []).forEach(function (u) { names[u.id] = u.name; });
    });
  }

  function loadLast() {
    return sb().from("chat_messages").select(MSG_COLS).order("created_at", { ascending: false }).limit(SHOW_FULL)
      .then(function (res) {
        if (res.error) throw res.error;
        msgs = (res.data || []).reverse();
      });
  }

  // priponka: naloži v bucket `chat` (kot chat.js), nato vrstica v chat_messages
  function sendFile(file) {
    if (file.size > S.MAX_BYTES) {
      toast("Datoteka je prevelika (" + S.formatSize(file.size) + "). Največ 50 MB.");
      return;
    }
    var caption = els && els.inp.value.trim();
    if (caption) { els.inp.value = ""; els.inp.dispatchEvent(new Event("input")); }
    var m = {
      id: S.uuid(),
      sender_id: uid,
      body: caption || null,
      file_path: uid + "/" + S.uuid(),
      file_name: file.name || "datoteka",
      file_size: file.size,
      file_mime: file.type || null,
      created_at: new Date().toISOString(),
      _pending: true,
      _pct: 0
    };
    add(m);
    markRead();
    var shown = 0;
    S.upload(sb(), "chat", m.file_path, file, function (pct) {
      m._pct = pct;
      if (pct - shown >= 4 || pct >= 100) { shown = pct; render(); }
    }).promise
      .then(function () {
        return sb().from("chat_messages").insert({
          id: m.id,
          body: m.body,
          file_path: m.file_path,
          file_name: m.file_name,
          file_size: m.file_size,
          file_mime: m.file_mime
        });
      })
      .then(function (res) {
        if (res && res.error) throw new Error("Pošiljanje ni uspelo.");
        m._pending = false;
        render();
      })
      .catch(function (err) {
        m._pending = false;
        m._failed = true;
        render();
        if (err && err.message !== "abort") toast(err.message);
        // neuspelo sporočilo po nekaj sekundah umakni
        setTimeout(function () {
          msgs = msgs.filter(function (x) { return x.id !== m.id; });
          render();
        }, 6000);
      });
  }

  function toast(text) {
    var t = document.querySelector(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.classList.add("is-visible");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("is-visible"); }, 3200);
  }

  function quickSend(text) {
    var m = { id: S.uuid(), sender_id: uid, body: text, created_at: new Date().toISOString() };
    add(m);
    markRead();
    sb().from("chat_messages").insert({ id: m.id, body: text }).then(function (res) {
      if (res.error) {
        msgs = msgs.filter(function (x) { return x.id !== m.id; });
        render();
        var t = document.querySelector(".toast");
        if (t) {
          t.textContent = "Sporočilo ni bilo poslano.";
          t.classList.add("is-visible");
          setTimeout(function () { t.classList.remove("is-visible"); }, 3000);
        }
      }
    });
  }

  function add(m) {
    if (msgs.some(function (x) { return x.id === m.id; })) return;
    msgs.push(m);
    msgs.sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
    if (msgs.length > SHOW_FULL + 10) msgs = msgs.slice(-SHOW_FULL);
    render(m.id);
  }

  function subscribe() {
    channel = sb().channel("chat-mini-" + uid)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, function (p) {
        var m = p.new;
        if (!m) return;
        var go = function () {
          if (m.sender_id !== uid && !msgs.some(function (x) { return x.id === m.id; })) {
            unread++;
            showBadge();
          }
          add(m);
        };
        if (!names[m.sender_id]) loadNames().then(go, go); else go();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, function (p) {
        var id = p.old && p.old.id;
        if (!id || !msgs.some(function (x) { return x.id === id; })) return;
        // izbrisano med zadnjimi → naloži znova, da se pokaže prejšnje
        loadLast().then(function () { render(); }, function () {});
      })
      .subscribe();
  }

  /* ---------- Življenjski cikel ---------- */

  function start(session) {
    if (!session || !session.user || !window.sb) return;
    if (uid === session.user.id) return;
    stop();
    uid = session.user.id;
    var me = uid;
    loadNames()
      .then(loadLast)
      .then(function () {
        if (uid !== me) return;
        ready = true;
        build();
        box.hidden = false;
        render();
        recount();
        subscribe();
      })
      .catch(function () { /* tabela še ne obstaja → mini klepet ostane skrit */ });
  }

  function stop() {
    if (expanded) setExpanded(false);
    if (channel && window.sb) window.sb.removeChannel(channel);
    channel = null;
    uid = null;
    msgs = [];
    unread = 0;
    ready = false;
    els = null;
    box.hidden = true;
    box.innerHTML = "";
    showBadge();
  }

  // ob vrnitvi s klepeta (bfcache ali preklop zavihka) osveži
  function refresh() {
    if (!ready) return;
    loadLast().then(function () { render(); recount(); }, function () {});
  }
  window.addEventListener("pageshow", function (e) { if (e.persisted) refresh(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
  setInterval(function () { if (ready && !document.hidden) render(); }, 60000); // „5 min“ → „6 min“

  document.addEventListener("ptomsetu:signed-in", function (e) { start(e.detail && e.detail.session); });
  document.addEventListener("ptomsetu:signed-out", stop);
  if (window.PTOMSETU_SESSION) start(window.PTOMSETU_SESSION);
})();

/* Klepet na plošči: mini klepet pod glavo (zadnja sporočila v živo + hiter
   odgovor) in značka neprebranih na gumbu Klepet. Cel klepet je chat.html. */
(function () {
  "use strict";

  var S = window.SERI;
  var box = document.getElementById("chatMini");
  var badge = document.getElementById("chatBadge");
  if (!S || !box) return;

  var SHOW = 3;
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
    head.appendChild(title);
    head.appendChild(tog);

    var list = document.createElement("a");
    list.className = "chat-mini-list";
    list.href = "chat.html";
    list.setAttribute("aria-label", "Odpri klepet");

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
    form.appendChild(inp);
    form.appendChild(send);

    box.appendChild(head);
    box.appendChild(list);
    box.appendChild(form);

    var c = collapsed();
    box.classList.toggle("is-collapsed", c);
    tog.setAttribute("aria-expanded", String(!c));
    tog.setAttribute("aria-label", c ? "Razširi klepet" : "Strni klepet");
    els = { list: list, count: count };
  }

  function render(animateId) {
    if (!els) return;
    els.list.innerHTML = "";
    els.count.textContent = unread ? unread + " novih" : "";
    els.count.hidden = !unread;
    var last = msgs.slice(-SHOW);
    if (!last.length) {
      var empty = document.createElement("span");
      empty.className = "chat-mini-empty";
      empty.textContent = "Še tiho. Pozdravi vse v TomStudios 👋";
      els.list.appendChild(empty);
      return;
    }
    last.forEach(function (m) {
      var row = document.createElement("span");
      var isNew = lastRead && m.sender_id !== uid && m.created_at > lastRead;
      row.className = "chat-mini-row" + (isNew ? " is-unread" : "") + (m.id === animateId ? " is-new" : "") +
        (m.sender_id === uid ? " is-me" : "");
      var c = S.personColors(m.sender_id);
      var av = document.createElement("i");
      av.className = "chat-mini-av";
      av.style.background = "linear-gradient(140deg," + c[0] + "," + c[1] + ")";
      av.textContent = S.initials(names[m.sender_id] || "?").charAt(0);
      var who = document.createElement("b");
      who.textContent = firstName(m.sender_id);
      var txt = document.createElement("span");
      txt.className = "chat-mini-txt";
      txt.textContent = preview(m);
      var when = document.createElement("em");
      when.textContent = ago(m.created_at);
      row.appendChild(av);
      row.appendChild(who);
      row.appendChild(txt);
      row.appendChild(when);
      els.list.appendChild(row);
    });
  }

  /* ---------- Podatki ---------- */

  function loadNames() {
    return sb().rpc("seri_users").then(function (res) {
      (res.data || []).forEach(function (u) { names[u.id] = u.name; });
    });
  }

  function loadLast() {
    return sb().from("chat_messages").select(MSG_COLS).order("created_at", { ascending: false }).limit(SHOW)
      .then(function (res) {
        if (res.error) throw res.error;
        msgs = (res.data || []).reverse();
      });
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
    if (msgs.length > 20) msgs = msgs.slice(-20);
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

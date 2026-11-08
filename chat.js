/* Klepet — ena skupna soba za vse uporabnike huba (chat.html).
   Sporočila: tabela chat_messages (za vedno), priponke: bucket `chat` (30 dni),
   odzivi: chat_reactions, prebrano: chat_reads (značka na plošči, chat-badge.js).
   V živo: postgres_changes (sporočila, odzivi) + broadcast „typing“ + presence. */
(function () {
  "use strict";

  var S = window.SERI;
  var $ = function (id) { return document.getElementById(id); };

  var gate = $("chatGate");
  var scrollEl = $("chatScroll");
  var listEl = $("chatList");
  var moreEl = $("chatMore");
  var emptyEl = $("chatEmpty");
  var jumpBtn = $("chatJump");
  var jumpTxt = $("chatJumpTxt");
  var foot = $("chatFoot");
  var typingEl = $("chatTyping");
  var form = $("chatForm");
  var input = $("chatInput");
  var sendBtn = $("chatSend");
  var fileInput = $("chatFile");
  var galleryInput = $("chatGallery");
  var menu = $("chatMenu");
  var menuEmojis = $("chatMenuEmojis");
  var menuDel = $("chatMenuDel");
  var veil = $("chatMenuVeil");
  var onlineEl = $("chatOnline");
  var onlineAvs = $("chatOnlineAvs");
  var onlineTxt = $("chatOnlineTxt");

  if (!window.SUPABASE_URL || !window.supabase || !S) {
    gate.textContent = "Supabase ni nastavljen.";
    return;
  }

  var BUCKET = "chat";
  var PAGE = 50;
  var FILE_DAYS = 30;
  var GROUP_MS = 5 * 60 * 1000;
  var EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
  var MSG_COLS = "id, sender_id, body, file_path, file_name, file_size, file_mime, created_at";

  var sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  var uid = null;
  var names = {};          // id → ime
  var msgs = [];           // naraščajoče po created_at
  var byId = {};           // id → sporočilo
  var reacts = {};         // message_id → [{user_id, emoji}]
  var urls = {};           // file_path → podpisan URL (ali objectURL med nalaganjem)
  var hasMore = true;
  var loadingOlder = false;
  var unseen = 0;
  var typing = {};         // user_id → čas poteka
  var lastTypingSent = 0;

  /* ---------- Pomožno ---------- */

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

  function firstName(id) {
    return (names[id] || "Nekdo").split(/\s+/)[0];
  }

  function fileExpired(m) {
    return Date.now() - Date.parse(m.created_at) > FILE_DAYS * 86400000;
  }

  function dayKey(d) { return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate(); }

  function dayLabel(d) {
    var now = new Date();
    var y = new Date(now); y.setDate(now.getDate() - 1);
    if (dayKey(d) === dayKey(now)) return "Danes";
    if (dayKey(d) === dayKey(y)) return "Včeraj";
    var opts = { weekday: "long", day: "numeric", month: "long" };
    if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
    return d.toLocaleDateString("sl-SI", opts);
  }

  function timeLabel(d) {
    return d.toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" });
  }

  // samo emoji (1–3) → velik prikaz brez mehurčka
  var EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*\s*){1,3}$/u;

  function appendText(el, text) {
    var re = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = document.createElement("a");
      a.href = m[1];
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = m[1];
      el.appendChild(a);
      last = m.index + m[1].length;
    }
    if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
  }

  function nearBottom() {
    return scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 120;
  }
  function toBottom(smooth) {
    scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  var DL_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
  var SMILE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></svg>';

  /* ---------- Izris ---------- */

  function sameGroup(a, b) {
    if (!a || !b || a.sender_id !== b.sender_id) return false;
    var da = new Date(a.created_at), db = new Date(b.created_at);
    return dayKey(da) === dayKey(db) && Math.abs(db - da) < GROUP_MS;
  }

  function renderAll() {
    listEl.innerHTML = "";
    var prev = null;
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      var d = new Date(m.created_at);
      if (!prev || dayKey(new Date(prev.created_at)) !== dayKey(d)) listEl.appendChild(daySep(d));
      listEl.appendChild(row(m, sameGroup(prev, m), sameGroup(m, msgs[i + 1])));
      prev = m;
    }
    emptyEl.hidden = msgs.length > 0;
    signImages();
  }

  function daySep(d) {
    var s = document.createElement("div");
    s.className = "chat-day";
    s.textContent = dayLabel(d);
    return s;
  }

  function rowEl(id) { return listEl.querySelector('.chat-row[data-id="' + id + '"]'); }

  // novo sporočilo na konec (brez ponovnega izrisa vsega)
  function appendRow(m, animate) {
    var prev = msgs[msgs.length - 2];
    var d = new Date(m.created_at);
    if (!prev || dayKey(new Date(prev.created_at)) !== dayKey(d)) listEl.appendChild(daySep(d));
    var grouped = sameGroup(prev, m);
    if (grouped) {
      var pr = rowEl(prev.id);
      if (pr) pr.classList.add("is-grouped-next");
    }
    var el = row(m, grouped, false);
    if (animate) el.classList.add("is-new");
    listEl.appendChild(el);
    emptyEl.hidden = true;
    signImages();
  }

  function row(m, groupedPrev, groupedNext) {
    var me = m.sender_id === uid;
    var el = document.createElement("div");
    el.className = "chat-row" + (me ? " is-me" : "") + (groupedPrev ? " is-grouped-prev" : "") +
      (groupedNext ? " is-grouped-next" : "") + (m._pending ? " is-pending" : "") + (m._failed ? " is-failed" : "");
    el.setAttribute("data-id", m.id);

    if (!me) {
      var c = S.personColors(m.sender_id);
      var av = document.createElement("span");
      av.className = "chat-av";
      av.style.setProperty("--pa", c[0]);
      av.style.setProperty("--pb", c[1]);
      av.textContent = S.initials(names[m.sender_id] || "?");
      av.setAttribute("aria-hidden", "true");
      el.appendChild(av);
    }

    var stack = document.createElement("div");
    stack.className = "chat-stack";
    if (!me) {
      var nm = document.createElement("span");
      nm.className = "chat-name";
      nm.textContent = names[m.sender_id] || "Nekdo";
      nm.style.setProperty("--name", S.personColors(m.sender_id)[0]);
      stack.appendChild(nm);
    }

    stack.appendChild(bubble(m));

    var rx = document.createElement("div");
    rx.className = "chat-reacts";
    fillReacts(rx, m.id);
    stack.appendChild(rx);

    var tm = document.createElement("span");
    tm.className = "chat-time";
    tm.textContent = m._pending ? "Pošiljam …" : timeLabel(new Date(m.created_at));
    stack.appendChild(tm);

    if (m._failed) {
      var fail = document.createElement("button");
      fail.type = "button";
      fail.className = "chat-fail";
      fail.textContent = m.file_path ? "Ni poslano." : "Ni poslano · tapni za ponovitev";
      fail.addEventListener("click", function () { retry(m); });
      stack.appendChild(fail);
    }
    el.appendChild(stack);

    if (!m._pending && !m._failed) {
      var rb = document.createElement("button");
      rb.type = "button";
      rb.className = "chat-react-btn";
      rb.setAttribute("aria-label", "Odzovi se");
      rb.innerHTML = SMILE_ICON;
      rb.addEventListener("click", function (e) { e.stopPropagation(); openMenu(m, el.querySelector(".chat-bubble")); });
      el.appendChild(rb);
      bindLongPress(el.querySelector(".chat-bubble"), m);
    }
    return el;
  }

  function bubble(m) {
    var b = document.createElement("div");
    b.className = "chat-bubble";
    if (m.file_path) {
      if (S.isImage(m.file_name, m.file_mime) && !fileExpired(m)) {
        b.classList.add("is-media");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chat-img" + (urls[m.file_path] ? "" : " is-loading");
        btn.setAttribute("aria-label", "Odpri sliko " + m.file_name);
        btn.setAttribute("data-path", m.file_path);
        if (urls[m.file_path]) btn.appendChild(img(m));
        btn.addEventListener("click", function () {
          if (!urls[m.file_path] || m._pending) return;
          S.lightbox({
            url: urls[m.file_path],
            name: m.file_name,
            mime: m.file_mime,
            onDownload: function (dl) { download(m, dl); }
          });
        });
        b.appendChild(btn);
      } else {
        b.appendChild(fileCard(m));
      }
      if (m._pending) {
        var up = document.createElement("div");
        up.className = "chat-up";
        up.innerHTML = "<span></span>";
        up.firstChild.style.width = (m._pct || 0) + "%";
        b.appendChild(up);
      }
      if (m.body) {
        var cap = document.createElement("div");
        cap.className = "chat-caption";
        appendText(cap, m.body);
        b.appendChild(cap);
      }
    } else {
      var text = m.body || "";
      if (EMOJI_ONLY.test(text.trim())) b.classList.add("is-emoji");
      appendText(b, text);
    }
    return b;
  }

  function img(m) {
    var i = document.createElement("img");
    i.alt = m.file_name;
    i.loading = "lazy";
    i.decoding = "async";
    var stick = nearBottom();
    i.onload = function () { if (stick) toBottom(false); };
    i.onerror = function () {
      var btn = i.parentNode;
      if (!btn) return;
      btn.classList.remove("is-loading");
      btn.replaceWith(fileCard(m));
    };
    i.src = urls[m.file_path];
    return i;
  }

  function fileCard(m) {
    var f = document.createElement("div");
    f.className = "chat-file";
    var c = S.kindColors(m.file_name, m.file_mime);
    f.style.setProperty("--doc-a", c[0]);
    f.style.setProperty("--doc-b", c[1]);
    var ic = document.createElement("span");
    ic.className = "chat-file-icon";
    ic.textContent = (S.ext(m.file_name) || "file").slice(0, 4).toUpperCase();
    var body = document.createElement("div");
    body.className = "chat-file-body";
    var nm = document.createElement("span");
    nm.className = "chat-file-name";
    nm.textContent = m.file_name;
    nm.title = m.file_name;
    var meta = document.createElement("span");
    meta.className = "chat-file-meta";
    meta.textContent = fileExpired(m) ? "Datoteka je potekla" : S.formatSize(Number(m.file_size) || 0);
    body.appendChild(nm);
    body.appendChild(meta);
    f.appendChild(ic);
    f.appendChild(body);
    if (!fileExpired(m) && !m._pending) {
      var dl = document.createElement("button");
      dl.type = "button";
      dl.className = "chat-file-dl";
      dl.setAttribute("aria-label", "Prenesi " + m.file_name);
      dl.innerHTML = DL_ICON;
      dl.addEventListener("click", function () { download(m, dl); });
      f.appendChild(dl);
    }
    return f;
  }

  function download(m, btn) {
    btn.disabled = true;
    S.downloadSigned(sb, BUCKET, m.file_path, m.file_name)
      .catch(function (e) { toast(e.message); })
      .then(function () { btn.disabled = false; });
  }

  // podpisani URL-ji za vse slike brez URL-ja, v enem klicu
  var signing = false;
  function signImages() {
    if (signing) return;
    var need = msgs.filter(function (m) {
      return m.file_path && !m._pending && !urls[m.file_path] && !m._noUrl &&
        S.isImage(m.file_name, m.file_mime) && !fileExpired(m);
    });
    if (!need.length) return;
    signing = true;
    sb.storage.from(BUCKET).createSignedUrls(need.map(function (m) { return m.file_path; }), 3600)
      .then(function (res) {
        signing = false;
        (res.data || []).forEach(function (r, i) {
          var m = need[i];
          if (r && r.signedUrl) {
            urls[m.file_path] = r.signedUrl;
            var btn = listEl.querySelector('.chat-img[data-path="' + m.file_path + '"]');
            if (btn && !btn.querySelector("img")) {
              btn.classList.remove("is-loading");
              btn.appendChild(img(m));
            }
          } else {
            m._noUrl = true;
          }
        });
      }, function () { signing = false; });
  }

  /* ---------- Odzivi ---------- */

  function fillReacts(rx, id) {
    rx.innerHTML = "";
    var list = reacts[id] || [];
    EMOJIS.forEach(function (e) {
      var who = list.filter(function (r) { return r.emoji === e; });
      if (!who.length) return;
      var mine = who.some(function (r) { return r.user_id === uid; });
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chat-react" + (mine ? " is-mine" : "");
      chip.title = who.map(function (r) { return r.user_id === uid ? "Ti" : firstName(r.user_id); }).join(", ");
      chip.appendChild(document.createTextNode(e));
      if (who.length > 1) {
        var n = document.createElement("b");
        n.textContent = who.length;
        chip.appendChild(n);
      }
      chip.addEventListener("click", function () { toggleReact(id, e); });
      rx.appendChild(chip);
    });
  }

  function refreshReacts(id) {
    var el = rowEl(id);
    if (el) fillReacts(el.querySelector(".chat-reacts"), id);
  }

  function hasReact(id, user, emoji) {
    return (reacts[id] || []).some(function (r) { return r.user_id === user && r.emoji === emoji; });
  }
  function addReactLocal(id, user, emoji) {
    if (hasReact(id, user, emoji)) return false;
    (reacts[id] = reacts[id] || []).push({ user_id: user, emoji: emoji });
    return true;
  }
  function removeReactLocal(id, user, emoji) {
    var before = (reacts[id] || []).length;
    reacts[id] = (reacts[id] || []).filter(function (r) { return !(r.user_id === user && r.emoji === emoji); });
    return reacts[id].length !== before;
  }

  function toggleReact(id, emoji) {
    if (hasReact(id, uid, emoji)) {
      removeReactLocal(id, uid, emoji);
      refreshReacts(id);
      sb.from("chat_reactions").delete().match({ message_id: id, user_id: uid, emoji: emoji })
        .then(function (res) { if (res.error) { addReactLocal(id, uid, emoji); refreshReacts(id); } });
    } else {
      addReactLocal(id, uid, emoji);
      refreshReacts(id);
      if (navigator.vibrate) navigator.vibrate(8);
      sb.from("chat_reactions").insert({ message_id: id, emoji: emoji })
        .then(function (res) {
          if (res.error && res.error.code !== "23505") { removeReactLocal(id, uid, emoji); refreshReacts(id); }
        });
    }
  }

  /* ---------- Meni (dolg pritisk / desni klik / gumb ob mehurčku) ---------- */

  var menuMsg = null;

  EMOJIS.forEach(function (e) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "menuitem");
    b.setAttribute("data-emoji", e);
    b.textContent = e;
    b.addEventListener("click", function () {
      var m = menuMsg;
      closeMenu();
      if (m) toggleReact(m.id, e);
    });
    menuEmojis.appendChild(b);
  });

  function openMenu(m, anchor) {
    menuMsg = m;
    var mine = m.sender_id === uid;
    menuDel.hidden = !mine;
    menuDel.classList.remove("is-confirm");
    menuDel.querySelector("span").textContent = "Izbriši";
    var btns = menuEmojis.querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("is-mine", hasReact(m.id, uid, btns[i].getAttribute("data-emoji")));
    }
    menu.hidden = false;
    veil.hidden = false;
    var r = anchor.getBoundingClientRect();
    var mw = menu.offsetWidth, mh = menu.offsetHeight;
    var left = mine ? r.right - mw : r.left;
    left = Math.max(8, Math.min(innerWidth - mw - 8, left));
    var top = r.top - mh - 8;
    if (top < 70) top = Math.min(innerHeight - mh - 8, r.bottom + 8);
    menu.style.left = left + "px";
    menu.style.top = top + "px";
    if (navigator.vibrate) navigator.vibrate(12);
  }

  function closeMenu() {
    menuMsg = null;
    menu.hidden = true;
    veil.hidden = true;
  }
  veil.addEventListener("click", closeMenu);
  veil.addEventListener("contextmenu", function (e) { e.preventDefault(); closeMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) closeMenu(); });
  scrollEl.addEventListener("scroll", function () { if (!menu.hidden) closeMenu(); }, { passive: true });

  menuDel.addEventListener("click", function () {
    if (!menuMsg) return;
    if (!menuDel.classList.contains("is-confirm")) {
      menuDel.classList.add("is-confirm");
      menuDel.querySelector("span").textContent = "Res izbrišem?";
      return;
    }
    var m = menuMsg;
    closeMenu();
    removeMessage(m);
  });

  function bindLongPress(el, m) {
    var timer = null, sx = 0, sy = 0;
    el.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      sx = e.clientX; sy = e.clientY;
      timer = setTimeout(function () { timer = null; openMenu(m, el); }, 430);
    });
    var cancel = function () { if (timer) { clearTimeout(timer); timer = null; } };
    el.addEventListener("pointermove", function (e) {
      if (timer && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) cancel();
    });
    el.addEventListener("pointerup", cancel);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("contextmenu", function (e) { e.preventDefault(); openMenu(m, el); });
  }

  /* ---------- Sporočila: dodajanje / brisanje ---------- */

  function insertLocal(m) {
    if (byId[m.id]) return false;
    byId[m.id] = m;
    // večinoma gre na konec; za vsak primer vstavi po času
    var i = msgs.length;
    while (i > 0 && msgs[i - 1].created_at > m.created_at) i--;
    msgs.splice(i, 0, m);
    return i === msgs.length - 1;
  }

  function onNewMessage(m, mineOptimistic) {
    var stick = nearBottom() || mineOptimistic;
    var atEnd = insertLocal(m);
    if (atEnd) appendRow(m, true);
    else renderAll();
    delete typing[m.sender_id];
    renderTyping();
    if (stick) toBottom(true);
    else if (m.sender_id !== uid) {
      unseen++;
      jumpTxt.textContent = unseen === 1 ? "1 novo sporočilo" : unseen + " novih sporočil";
      jumpBtn.hidden = false;
    }
    if (m.sender_id !== uid) markRead();
  }

  function removeLocal(id) {
    if (!byId[id]) return;
    delete byId[id];
    delete reacts[id];
    msgs = msgs.filter(function (m) { return m.id !== id; });
    renderAll();
  }

  function removeMessage(m) {
    removeLocal(m.id);
    var p = m.file_path ? sb.storage.from(BUCKET).remove([m.file_path]) : Promise.resolve();
    p.then(function () { return sb.from("chat_messages").delete().eq("id", m.id); })
      .then(function (res) { if (res && res.error) toast("Brisanje ni uspelo."); });
  }

  function sendText(text) {
    var m = {
      id: S.uuid(),
      sender_id: uid,
      body: text,
      created_at: new Date().toISOString(),
      _pending: true
    };
    onNewMessage(m, true);
    persist(m);
  }

  function persist(m) {
    var row = { id: m.id, body: m.body || null };
    if (m.file_path) {
      row.file_path = m.file_path;
      row.file_name = m.file_name;
      row.file_size = m.file_size;
      row.file_mime = m.file_mime;
    }
    return sb.from("chat_messages").insert(row).select("created_at").single().then(function (res) {
      if (res.error) throw res.error;
      m._pending = false;
      m._failed = false;
      if (res.data && res.data.created_at) m.created_at = res.data.created_at;
      replaceRow(m);
    }).catch(function () {
      m._pending = false;
      m._failed = true;
      replaceRow(m);
    });
  }

  function replaceRow(m) {
    var old = rowEl(m.id);
    if (!old) return;
    var el = row(m, old.classList.contains("is-grouped-prev"), old.classList.contains("is-grouped-next"));
    old.replaceWith(el);
    signImages();
  }

  function retry(m) {
    if (m.file_path) { removeLocal(m.id); return; }
    m._failed = false;
    m._pending = true;
    replaceRow(m);
    persist(m);
  }

  function sendFile(file) {
    if (file.size > S.MAX_BYTES) {
      toast("Datoteka je prevelika (" + S.formatSize(file.size) + "). Največ 50 MB.");
      return;
    }
    var caption = input.value.trim();
    if (caption) { input.value = ""; autoGrow(); updateSend(); }
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
    if (S.isImage(file.name, file.type)) {
      try { urls[m.file_path] = URL.createObjectURL(file); } catch (e) {}
    }
    onNewMessage(m, true);
    var up = S.upload(sb, BUCKET, m.file_path, file, function (pct) {
      m._pct = pct;
      var el = rowEl(m.id);
      var bar = el && el.querySelector(".chat-up span");
      if (bar) bar.style.width = pct + "%";
    });
    up.promise.then(function () { return persist(m); }, function (err) {
      m._pending = false;
      m._failed = true;
      replaceRow(m);
      if (err.message !== "abort") toast(err.message);
    });
  }

  /* ---------- Pisanje ---------- */

  function autoGrow() {
    input.style.height = "auto";
    input.style.height = Math.min(140, input.scrollHeight) + "px";
  }
  function updateSend() { sendBtn.disabled = !input.value.trim(); }

  input.addEventListener("input", function () {
    autoGrow();
    updateSend();
    var now = Date.now();
    if (input.value.trim() && now - lastTypingSent > 2000 && room) {
      lastTypingSent = now;
      room.send({ type: "broadcast", event: "typing", payload: { id: uid } });
    }
  });

  var coarse = window.matchMedia && matchMedia("(pointer: coarse)").matches;
  input.addEventListener("keydown", function (e) {
    // računalnik: Enter pošlje, Shift+Enter nova vrstica; telefon: Enter = nova vrstica
    if (e.key === "Enter" && !e.shiftKey && !coarse && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    autoGrow();
    updateSend();
    sendBtn.classList.remove("is-fired");
    void sendBtn.offsetWidth;
    sendBtn.classList.add("is-fired");
    lastTypingSent = 0;
    sendText(text);
    if (coarse) input.focus();
  });

  $("chatAttach").addEventListener("click", function () { fileInput.click(); });
  $("chatPhoto").addEventListener("click", function () { galleryInput.click(); });
  [fileInput, galleryInput].forEach(function (inp) {
    inp.addEventListener("change", function () {
      var files = Array.prototype.slice.call(inp.files || [], 0, 10);
      files.forEach(sendFile);
      inp.value = "";
    });
  });

  // prilepi sliko iz odložišča
  input.addEventListener("paste", function (e) {
    var items = (e.clipboardData && e.clipboardData.files) || [];
    if (items.length) { e.preventDefault(); Array.prototype.forEach.call(items, sendFile); }
  });

  // spusti datoteke na stran (računalnik)
  document.addEventListener("dragover", function (e) { e.preventDefault(); });
  document.addEventListener("drop", function (e) {
    e.preventDefault();
    if (!uid) return;
    var files = (e.dataTransfer && e.dataTransfer.files) || [];
    Array.prototype.slice.call(files, 0, 10).forEach(sendFile);
  });

  /* ---------- Kdo tipka / kdo je na spletu ---------- */

  function renderTyping() {
    var now = Date.now();
    var who = Object.keys(typing).filter(function (id) { return typing[id] > now && id !== uid; });
    typingEl.innerHTML = "";
    if (!who.length) return;
    var dots = document.createElement("span");
    dots.className = "chat-dots";
    dots.innerHTML = "<i></i><i></i><i></i>";
    var txt = document.createElement("span");
    var n = who.map(firstName);
    txt.textContent = n.length === 1 ? n[0] + " tipka …"
      : n.length === 2 ? n[0] + " in " + n[1] + " tipkata …"
      : n.length + " ljudje tipkajo …";
    typingEl.appendChild(dots);
    typingEl.appendChild(txt);
  }
  setInterval(function () { if (Object.keys(typing).length) renderTyping(); }, 1000);

  function renderOnline() {
    if (!room) return;
    var state = room.presenceState();
    var ids = Object.keys(state).filter(function (id) { return names[id] || id === uid; });
    onlineEl.hidden = ids.length === 0;
    onlineAvs.innerHTML = "";
    ids.slice(0, 5).forEach(function (id) {
      var c = S.personColors(id);
      var i = document.createElement("i");
      i.style.background = "linear-gradient(140deg," + c[0] + "," + c[1] + ")";
      i.textContent = S.initials(names[id] || "?").charAt(0);
      i.title = id === uid ? "Ti" : (names[id] || "");
      onlineAvs.appendChild(i);
    });
    onlineTxt.textContent = ids.length === 1 ? "samo ti na spletu" : ids.length + " na spletu";
  }

  /* ---------- Nalaganje in Realtime ---------- */

  var room = null;
  var db = null;

  function loadReacts(list) {
    var ids = list.map(function (m) { return m.id; });
    if (!ids.length) return Promise.resolve();
    return sb.from("chat_reactions").select("message_id, user_id, emoji").in("message_id", ids)
      .then(function (res) {
        (res.data || []).forEach(function (r) { addReactLocal(r.message_id, r.user_id, r.emoji); });
      });
  }

  function loadLatest() {
    return sb.from("chat_messages").select(MSG_COLS).order("created_at", { ascending: false }).limit(PAGE)
      .then(function (res) {
        if (res.error) throw res.error;
        var list = (res.data || []).reverse();
        hasMore = list.length === PAGE;
        list.forEach(function (m) { if (!byId[m.id]) { byId[m.id] = m; msgs.push(m); } });
        msgs.sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
        return loadReacts(list);
      });
  }

  function loadOlder() {
    if (loadingOlder || !hasMore || !msgs.length) return;
    loadingOlder = true;
    moreEl.hidden = false;
    var oldest = msgs[0].created_at;
    sb.from("chat_messages").select(MSG_COLS).lt("created_at", oldest)
      .order("created_at", { ascending: false }).limit(PAGE)
      .then(function (res) {
        var list = ((res && res.data) || []).reverse();
        hasMore = list.length === PAGE;
        return loadReacts(list).then(function () { return list; });
      })
      .then(function (list) {
        var fromBottom = scrollEl.scrollHeight - scrollEl.scrollTop;
        list.forEach(function (m) { if (!byId[m.id]) byId[m.id] = m; });
        msgs = list.filter(function (m) { return byId[m.id] === m; }).concat(msgs);
        renderAll();
        scrollEl.scrollTop = scrollEl.scrollHeight - fromBottom;
      })
      .catch(function () {})
      .then(function () { loadingOlder = false; moreEl.hidden = true; });
  }

  scrollEl.addEventListener("scroll", function () {
    if (scrollEl.scrollTop < 120) loadOlder();
    if (nearBottom() && !jumpBtn.hidden) { jumpBtn.hidden = true; unseen = 0; }
  }, { passive: true });
  jumpBtn.addEventListener("click", function () { jumpBtn.hidden = true; unseen = 0; toBottom(true); });

  function subscribe() {
    db = sb.channel("chat-db")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, function (p) {
        var m = p.new;
        if (!m || byId[m.id]) return;
        var show = function () { onNewMessage(m, false); };
        if (!names[m.sender_id]) loadNames().then(show, show); else show();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, function (p) {
        if (p.old && p.old.id) removeLocal(p.old.id);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_reactions" }, function (p) {
        var r = p.new;
        if (r && byId[r.message_id] && addReactLocal(r.message_id, r.user_id, r.emoji)) refreshReacts(r.message_id);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_reactions" }, function (p) {
        var r = p.old;
        if (r && r.message_id && removeReactLocal(r.message_id, r.user_id, r.emoji)) refreshReacts(r.message_id);
      })
      .subscribe();

    room = sb.channel("chat-room", { config: { presence: { key: uid }, broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, function (p) {
        var id = p.payload && p.payload.id;
        if (!id || id === uid) return;
        typing[id] = Date.now() + 4000;
        renderTyping();
      })
      .on("presence", { event: "sync" }, renderOnline)
      .subscribe(function (status) {
        if (status === "SUBSCRIBED") room.track({ at: Date.now() });
      });
  }

  // prebrano → chat_reads (za značko na plošči)
  var readTimer = null;
  function markRead() {
    if (document.hidden) return;
    clearTimeout(readTimer);
    readTimer = setTimeout(function () {
      sb.from("chat_reads").upsert({ user_id: uid, last_read_at: new Date().toISOString() }).then(function () {});
    }, 800);
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && uid) markRead(); });

  // svoje priponke, starejše od 30 dni, pobriši (prostor na brezplačnem paketu)
  function cleanup() {
    sb.storage.from(BUCKET).list(uid, { limit: 200, sortBy: { column: "created_at", order: "asc" } })
      .then(function (res) {
        var cutoff = Date.now() - FILE_DAYS * 86400000;
        var old = ((res && res.data) || [])
          .filter(function (f) { return f.created_at && Date.parse(f.created_at) < cutoff; })
          .map(function (f) { return uid + "/" + f.name; });
        if (old.length) return sb.storage.from(BUCKET).remove(old);
      })
      .catch(function () {});
  }

  function loadNames() {
    return sb.rpc("seri_users").then(function (res) {
      (res.data || []).forEach(function (u) { names[u.id] = u.name; });
    });
  }

  function start(session) {
    uid = session.user.id;
    loadNames()
      .then(loadLatest)
      .then(function () {
        gate.hidden = true;
        scrollEl.hidden = false;
        foot.hidden = false;
        renderAll();
        toBottom(false);
        // slike se naložijo kasneje → še enkrat na dno
        setTimeout(function () { toBottom(false); }, 300);
        subscribe();
        markRead();
        cleanup();
        if (!coarse) input.focus();
      })
      .catch(function () {
        gate.textContent = "Klepet še ni pripravljen (baza). Poskusi kasneje.";
      });
  }

  sb.auth.getSession().then(function (res) {
    var s = res && res.data && res.data.session;
    if (!s) { location.replace("./"); return; }
    start(s);
  });
  sb.auth.onAuthStateChange(function (event) {
    if (event === "SIGNED_OUT") location.replace("./");
  });
})();

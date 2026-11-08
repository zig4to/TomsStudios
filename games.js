/* Igre za 2 igralca — skupno za klepet (chat.js), mini klepet (chat-mini.js) in igra.html.
   window.BITGAMES:
     init({ sb, uid, name, toast })  — funkcije, ki vrnejo klienta, moj id, ime po id-ju
     card(gameId)                     — kartica izziva v oblačku (osveži se v živo)
     challenge()                      — izbirnik nasprotnika → game_challenge → igra.html
     miniBoard(board, winCells)       — majhna mreža za kartico in lestvico
   Pravila in rok za potezo so na strežniku (supabase/009_games.sql). */
(function () {
  "use strict";

  var ACCEPT_MS = 5 * 60 * 1000;
  var GAME_NAME = { connect4: "Štiri v vrsto" };
  var opts = null;
  var cache = {};          // id → tekma
  var want = {};           // id-ji, ki jih je treba naložiti
  var loadTimer = null;
  var channel = null;

  function sb() { return opts && opts.sb(); }
  function uid() { return opts && opts.uid(); }
  function name(id) { return (opts && opts.name(id)) || "Nekdo"; }
  function first(id) { return id === uid() ? "Ti" : name(id).split(/\s+/)[0]; }
  function toast(t) { if (opts && opts.toast) opts.toast(t); }

  function url(id) { return "igra.html?id=" + encodeURIComponent(id); }
  function expired(m) { return m.status === "pending" && Date.now() - Date.parse(m.created_at) > ACCEPT_MS; }

  function errText(e) {
    var msg = (e && (e.message || e.details)) || "";
    return msg && msg.length < 120 ? msg : "Ni uspelo. Poskusi znova.";
  }

  /* ---------- Nalaganje in Realtime ---------- */

  function queue(id) {
    if (cache[id] || want[id]) return;
    want[id] = true;
    clearTimeout(loadTimer);
    loadTimer = setTimeout(flush, 30);
  }

  function flush() {
    var ids = Object.keys(want);
    want = {};
    if (!ids.length || !sb()) return;
    sb().from("game_matches").select("*").in("id", ids).then(function (res) {
      (res.data || []).forEach(put);
    });
    subscribe();
  }

  function put(m) {
    if (!m || !m.id) return;
    var old = cache[m.id];
    if (old && old.updated_at && m.updated_at && old.updated_at > m.updated_at) return;
    cache[m.id] = m;
    refresh(m.id);
  }

  function subscribe() {
    if (channel || !sb()) return;
    channel = sb().channel("games-cards-" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "game_matches" }, function (p) {
        if (p.new && p.new.id && (cache[p.new.id] || p.eventType === "INSERT")) put(p.new);
      })
      .subscribe();
  }

  function refresh(id) {
    var list = document.querySelectorAll('.game-card[data-game="' + id + '"]');
    for (var i = 0; i < list.length; i++) fill(list[i], cache[id]);
  }

  // potečen izziv se preriše, ko mine 5 minut
  setInterval(function () {
    Object.keys(cache).forEach(function (id) {
      var m = cache[id];
      if (m.status === "pending") refresh(id);
    });
  }, 15000);

  /* ---------- Kartica ---------- */

  function miniBoard(board, winCells) {
    var g = document.createElement("div");
    g.className = "game-mini";
    var win = {};
    (winCells || []).forEach(function (i) { win[i] = true; });
    for (var i = 0; i < 42; i++) {
      var d = document.createElement("i");
      var ch = board ? board.charAt(i) : "0";
      if (ch === "1") d.className = "is-a";
      else if (ch === "2") d.className = "is-b";
      if (win[i]) d.className += " is-win";
      g.appendChild(d);
    }
    return g;
  }

  function card(id) {
    var el = document.createElement("div");
    el.className = "game-card";
    el.setAttribute("data-game", id);
    el.addEventListener("click", function (e) {
      e.stopPropagation();
      if (e.target.closest("button")) return;
      location.href = url(id);
    });
    if (cache[id]) fill(el, cache[id]);
    else { el.classList.add("is-loading"); el.innerHTML = '<span class="game-card-title">🎮 Igra …</span>'; queue(id); }
    return el;
  }

  function btn(label, cls, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "game-card-btn" + (cls ? " " + cls : "");
    b.textContent = label;
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      b.disabled = true;
      fn(b);
    });
    return b;
  }

  function fill(el, m) {
    if (!el || !m) return;
    var me = uid();
    var mine = me === m.player_a || me === m.player_b;
    el.className = "game-card is-" + (expired(m) ? "expired" : m.status);
    el.innerHTML = "";

    var head = document.createElement("div");
    head.className = "game-card-head";
    head.innerHTML = '<span class="game-card-icon" aria-hidden="true">' + ICON + "</span>";
    var t = document.createElement("div");
    t.className = "game-card-text";
    var title = document.createElement("strong");
    title.className = "game-card-title";
    title.textContent = GAME_NAME[m.game] || "Igra";
    var vs = document.createElement("span");
    vs.className = "game-card-vs";
    vs.innerHTML = '<i class="game-dot is-a"></i>';
    vs.appendChild(document.createTextNode(first(m.player_a) + "  vs  "));
    var dotB = document.createElement("i");
    dotB.className = "game-dot is-b";
    vs.appendChild(dotB);
    vs.appendChild(document.createTextNode(first(m.player_b)));
    t.appendChild(title);
    t.appendChild(vs);
    head.appendChild(t);
    el.appendChild(head);

    var st = document.createElement("div");
    st.className = "game-card-status";
    var actions = document.createElement("div");
    actions.className = "game-card-actions";

    if (m.status === "pending" && expired(m)) {
      st.textContent = "Izziv je potekel.";
    } else if (m.status === "pending") {
      if (me === m.player_b) {
        st.textContent = first(m.player_a) + " te izziva! ⚔️";
        actions.appendChild(btn("Sprejmi", "is-go", function (b) {
          sb().rpc("game_respond", { p_match: m.id, p_accept: true }).then(function (res) {
            if (res.error) { b.disabled = false; toast(errText(res.error)); return; }
            location.href = url(m.id);
          });
        }));
        actions.appendChild(btn("Zavrni", "", function (b) {
          sb().rpc("game_respond", { p_match: m.id, p_accept: false }).then(function (res) {
            if (res.error) { b.disabled = false; toast(errText(res.error)); return; }
            put(res.data);
          });
        }));
      } else if (me === m.player_a) {
        st.textContent = "Čakam, da " + first(m.player_b) + " sprejme …";
        actions.appendChild(btn("Prekliči", "", function (b) {
          sb().rpc("game_cancel", { p_match: m.id }).then(function (res) {
            if (res.error) { b.disabled = false; toast(errText(res.error)); return; }
            put(res.data);
          });
        }));
      } else {
        st.textContent = "Čaka na odgovor …";
      }
    } else if (m.status === "declined") {
      st.textContent = first(m.player_b) + " je zavrnil/a izziv.";
    } else if (m.status === "cancelled") {
      st.textContent = "Izziv preklican.";
    } else if (m.status === "active") {
      st.textContent = m.turn === me ? "V teku · ti si na potezi!" : "V teku · na potezi " + first(m.turn);
      el.appendChild(miniBoard(m.board));
      actions.appendChild(btn(mine ? "Igraj" : "Glej", "is-go", function () { location.href = url(m.id); }));
    } else if (m.status === "done") {
      var why = m.end_reason === "timeout" ? " (čas je potekel)" : m.end_reason === "resign" ? " (predaja)" : "";
      st.textContent = m.end_reason === "draw" ? "Neodločeno 🤝"
        : "🏆 Zmaga: " + (m.winner === me ? "ti" : first(m.winner)) + why;
      el.appendChild(miniBoard(m.board, m.win_cells));
      if (mine) {
        var opp = me === m.player_a ? m.player_b : m.player_a;
        actions.appendChild(btn("Revanša", "is-go", function (b) {
          rematch(opp, b);
        }));
      }
    }
    el.appendChild(st);
    if (actions.childNodes.length) el.appendChild(actions);
  }

  function rematch(opp, b) {
    sb().rpc("game_challenge", { p_opponent: opp }).then(function (res) {
      if (res.error) { if (b) b.disabled = false; toast(errText(res.error)); return; }
      location.href = url(res.data);
    });
  }

  /* ---------- Izbirnik nasprotnika ---------- */

  function challenge(people) {
    // people: [{id, name}] brez mene
    var veil = document.createElement("div");
    veil.className = "game-sheet-veil";
    var sheet = document.createElement("div");
    sheet.className = "game-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-label", "Izzovi na igro");
    var h = document.createElement("div");
    h.className = "game-sheet-head";
    h.innerHTML = '<span class="game-card-icon" aria-hidden="true">' + ICON + "</span><div><strong>Štiri v vrsto</strong><span>Koga izzoveš? · 8 s na potezo</span></div>";
    sheet.appendChild(h);

    var list = document.createElement("div");
    list.className = "game-sheet-list";
    if (!people.length) {
      var e = document.createElement("p");
      e.className = "game-sheet-empty";
      e.textContent = "Ni drugih uporabnikov.";
      list.appendChild(e);
    }
    people.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "game-sheet-person";
      var c = window.SERI ? window.SERI.personColors(p.id) : ["#a855f7", "#ec4899"];
      var av = document.createElement("i");
      av.style.background = "linear-gradient(140deg," + c[0] + "," + c[1] + ")";
      av.textContent = window.SERI ? window.SERI.initials(p.name) : p.name.charAt(0);
      var n = document.createElement("span");
      n.textContent = p.name;
      b.appendChild(av);
      b.appendChild(n);
      b.addEventListener("click", function () {
        b.disabled = true;
        b.classList.add("is-busy");
        rematch(p.id, b);
      });
      list.appendChild(b);
    });
    sheet.appendChild(list);

    var cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "game-sheet-cancel";
    cancel.textContent = "Prekliči";
    sheet.appendChild(cancel);

    function close() {
      document.removeEventListener("keydown", onKey);
      veil.classList.remove("is-open");
      setTimeout(function () { veil.remove(); }, 220);
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    cancel.addEventListener("click", close);
    veil.addEventListener("click", function (e) { if (e.target === veil) close(); });
    document.addEventListener("keydown", onKey);

    veil.appendChild(sheet);
    document.body.appendChild(veil);
    requestAnimationFrame(function () { veil.classList.add("is-open"); });
  }

  // Lucide „gamepad-2“
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/></svg>';

  window.BITGAMES = {
    init: function (o) { opts = o; },
    card: card,
    challenge: challenge,
    miniBoard: miniBoard,
    put: put,
    errText: errText,
    url: url,
    ICON: ICON,
    GAME_NAME: GAME_NAME,
    ACCEPT_MS: ACCEPT_MS
  };
})();

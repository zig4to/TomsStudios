/* Štiri v vrsto (igra.html?id=…) in lestvica (igra.html).
   Pravila, rok za potezo (8 s) in zmaga se preverjajo na strežniku (009_games.sql);
   tukaj samo izris, optimistična poteza in štetje časa. */
(function () {
  "use strict";

  var G = window.BITGAMES;
  var S = window.SERI;
  var $ = function (id) { return document.getElementById(id); };
  var gate = $("igraGate");

  if (!window.SUPABASE_URL || !window.supabase || !G) {
    gate.textContent = "Supabase ni nastavljen.";
    return;
  }

  var sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  var uid = null;
  var names = {};
  var matchId = new URLSearchParams(location.search).get("id");

  function toast(text) {
    var t = document.querySelector(".toast");
    if (!t) return;
    t.textContent = text;
    t.classList.add("is-visible");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("is-visible"); }, 3200);
  }
  function nameOf(id) { return names[id] || "Nekdo"; }
  function first(id) { return nameOf(id).split(/\s+/)[0]; }

  G.init({ sb: function () { return sb; }, uid: function () { return uid; }, name: nameOf, toast: toast });

  function loadNames() {
    return sb.rpc("seri_users").then(function (res) {
      (res.data || []).forEach(function (u) { names[u.id] = u.name; });
    });
  }
  function people() {
    return Object.keys(names).filter(function (id) { return id !== uid; })
      .map(function (id) { return { id: id, name: names[id] }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name, "sl"); });
  }

  /* =================== Tekma =================== */

  var m = null;            // trenutno stanje (lahko optimistično)
  var skew = 0;            // strežnik − odjemalec (ms)
  var busy = false;        // poteza na poti
  var claiming = 0;        // zadnji poskus game_timeout
  var buzzed = {};         // vibracija v zadnjih sekundah
  var celebrated = false;
  var hoverCol = -1;
  var cells = [];
  var ghosts = [];
  var board = $("c4Board");
  var ghostRow = $("c4Ghosts");
  var timerEl = $("c4Timer");
  var timerFill = $("c4TimerFill");
  var timerNum = $("c4TimerNum");
  var statusEl = $("c4Status");
  var panel = $("c4Panel");
  var resignBtn = $("c4Resign");
  var banner = $("c4Banner");
  var baseTitle = document.title;

  function mineSide() { return !m ? null : uid === m.player_a ? "a" : uid === m.player_b ? "b" : null; }
  function opponent() { return !m ? null : uid === m.player_a ? m.player_b : m.player_a; }
  function myTurn() { return m && m.status === "active" && m.turn === uid && !busy; }
  function serverNow() { return Date.now() + skew; }

  function setState(next, fromRpc) {
    if (!next) return;
    if (fromRpc && next.server_now) skew = Date.parse(next.server_now) - Date.now();
    if (m && !fromRpc && next.updated_at && m.updated_at && next.updated_at < m.updated_at) return;
    var prev = m;
    m = next;
    G.put(next);
    render(prev);
  }

  function buildBoard() {
    board.innerHTML = "";
    ghostRow.innerHTML = "";
    cells = [];
    ghosts = [];
    for (var c = 0; c < 7; c++) {
      var g = document.createElement("i");
      ghostRow.appendChild(g);
      ghosts.push(g);
    }
    for (var i = 0; i < 42; i++) {
      var cell = document.createElement("div");
      cell.className = "c4-cell";
      cell.setAttribute("data-col", String(i % 7));
      cell.setAttribute("role", "gridcell");
      board.appendChild(cell);
      cells.push(cell);
    }
    board.addEventListener("click", function (e) {
      var cell = e.target.closest(".c4-cell");
      if (cell) play(+cell.getAttribute("data-col"));
    });
    board.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      var cell = e.target.closest(".c4-cell");
      setHover(cell ? +cell.getAttribute("data-col") : -1);
    });
    board.addEventListener("pointerleave", function () { setHover(-1); });
    document.addEventListener("keydown", function (e) {
      if (!myTurn()) return;
      if (e.key >= "1" && e.key <= "7") play(+e.key - 1);
      else if (e.key === "ArrowLeft") setHover(hoverCol <= 0 ? 6 : hoverCol - 1);
      else if (e.key === "ArrowRight") setHover(hoverCol < 0 || hoverCol >= 6 ? 0 : hoverCol + 1);
      else if ((e.key === "Enter" || e.key === " ") && hoverCol >= 0) { e.preventDefault(); play(hoverCol); }
    });
  }

  function setHover(col) {
    hoverCol = col;
    var live = myTurn();
    for (var i = 0; i < 42; i++) cells[i].classList.toggle("is-col", live && i % 7 === col);
    ghosts.forEach(function (g, c) { g.classList.toggle("is-on", live && c === col); });
  }

  function landing(b, col) {
    for (var r = 5; r >= 0; r--) if (b.charAt(r * 7 + col) === "0") return r * 7 + col;
    return -1;
  }

  function drawDiscs(animIdx) {
    var win = {};
    (m.win_cells || []).forEach(function (i) { win[i] = true; });
    for (var i = 0; i < 42; i++) {
      var ch = m.board.charAt(i);
      var cell = cells[i];
      var disc = cell.firstChild;
      if (ch === "0") { if (disc) cell.removeChild(disc); continue; }
      var side = ch === "1" ? "a" : "b";
      if (!disc) {
        disc = document.createElement("span");
        cell.appendChild(disc);
        if (i === animIdx) {
          var row = Math.floor(i / 7);
          disc.style.setProperty("--from", "calc(" + -(row + 1) + " * 112%)");
          disc.style.setProperty("--dur", (0.28 + row * 0.07).toFixed(2) + "s");
          disc.className = "c4-disc is-drop";
        }
      }
      disc.className = "c4-disc is-" + side + (disc.classList.contains("is-drop") ? " is-drop" : "") +
        (i === m.last_idx ? " is-last" : "") + (win[i] ? " is-win" : "");
    }
    board.classList.toggle("is-done", m.status === "done" && !!m.win_cells);
  }

  function render(prev) {
    var side = mineSide();
    var me = uid;
    $("c4NameA").textContent = m.player_a === me ? "Ti" : first(m.player_a);
    $("c4NameB").textContent = m.player_b === me ? "Ti" : first(m.player_b);
    $("c4SubA").textContent = m.status === "active" && m.first_player === m.player_a && m.moves === 0 ? "začne" : "izzivalec";
    $("c4SubB").textContent = m.status === "active" && m.first_player === m.player_b && m.moves === 0 ? "začne" : "izzvan";
    var active = m.status === "active";
    $("c4PlayerA").classList.toggle("is-turn", active && m.turn === m.player_a);
    $("c4PlayerB").classList.toggle("is-turn", active && m.turn === m.player_b);
    ghostRow.className = "c4-ghosts" + (side ? " is-" + side : "");
    $("c4Spectate").hidden = !!side || m.status !== "active";

    // nova plošča → animiraj zadnji padli žeton (če ga še ni)
    var animIdx = (!prev || m.moves > prev.moves) && m.last_idx != null ? m.last_idx : -1;
    drawDiscs(animIdx);

    board.classList.toggle("is-live", myTurn());
    setHover(myTurn() ? hoverCol : -1);
    resignBtn.hidden = !(active && side);

    // stanje
    statusEl.style.removeProperty("color");
    if (m.status === "active") {
      if (m.turn === me) {
        statusEl.textContent = busy ? "…" : "Tvoja poteza!";
        statusEl.style.color = side === "a" ? "var(--c4-a)" : "var(--c4-b)";
      } else {
        statusEl.textContent = "Na potezi je " + (m.turn === m.player_a ? $("c4NameA").textContent : $("c4NameB").textContent);
      }
      if (prev && prev.turn !== uid && m.turn === uid && navigator.vibrate) navigator.vibrate(30);
    } else if (m.status === "pending") {
      statusEl.textContent = "";
    } else {
      statusEl.textContent = "";
    }
    document.title = m.status === "active" && m.turn === me ? "⏱ Tvoja poteza! · Štiri v vrsto" : baseTitle;

    renderPanel(prev);
    tick();
  }

  function renderPanel(prev) {
    var me = uid;
    var side = mineSide();
    panel.className = "c4-panel";
    panel.innerHTML = "";
    var show = true;
    var h = document.createElement("h2");
    var p = document.createElement("p");
    var act = document.createElement("div");
    act.className = "c4-actions";

    if (m.status === "pending" && Date.now() - Date.parse(m.created_at) > G.ACCEPT_MS) {
      h.textContent = "Izziv je potekel";
      p.textContent = "Nihče ni sprejel v 5 minutah.";
      if (side) act.appendChild(button("Nov izziv", "is-go", function (b) { rematch(b); }));
    } else if (m.status === "pending") {
      if (me === m.player_b) {
        h.textContent = first(m.player_a) + " te izziva! ⚔️";
        p.textContent = "8 sekund na potezo. Kdor zamudi, izgubi.";
        act.appendChild(button("Sprejmi", "is-go", function (b) {
          sb.rpc("game_respond", { p_match: m.id, p_accept: true }).then(function (res) {
            if (res.error) { b.disabled = false; toast(G.errText(res.error)); return; }
            setState(res.data, true);
          });
        }));
        act.appendChild(button("Zavrni", "", function (b) {
          sb.rpc("game_respond", { p_match: m.id, p_accept: false }).then(function (res) {
            if (res.error) { b.disabled = false; toast(G.errText(res.error)); return; }
            setState(res.data, true);
          });
        }));
      } else if (me === m.player_a) {
        h.textContent = "Čakam na " + first(m.player_b) + " …";
        p.id = "c4Wait";
        act.appendChild(button("Prekliči izziv", "", function (b) {
          sb.rpc("game_cancel", { p_match: m.id }).then(function (res) {
            if (res.error) { b.disabled = false; toast(G.errText(res.error)); return; }
            setState(res.data, true);
          });
        }));
      } else {
        h.textContent = "Čaka na odgovor …";
      }
    } else if (m.status === "declined") {
      h.textContent = "Izziv zavrnjen";
      p.textContent = first(m.player_b) + " tokrat ne igra.";
    } else if (m.status === "cancelled") {
      h.textContent = "Izziv preklican";
    } else if (m.status === "done") {
      var why = m.end_reason === "timeout" ? "Čas za potezo je potekel ⏱"
        : m.end_reason === "resign" ? "Predaja 🏳️" : m.end_reason === "draw" ? "Plošča je polna." : "Štiri v vrsto!";
      if (m.end_reason === "draw") { h.textContent = "Neodločeno 🤝"; }
      else if (side && m.winner === me) { h.textContent = "Zmaga! 🏆"; panel.classList.add("is-win"); }
      else if (side) { h.textContent = "Poraz 😢"; }
      else { h.textContent = "🏆 " + first(m.winner); }
      p.textContent = why;
      if (side) act.appendChild(button("Revanša", "is-go", function (b) { rematch(b); }));
      act.appendChild(link("Lestvica", "igra.html"));
      if (prev && prev.status !== "done") {
        panel.classList.add("is-pop");
        if (side && m.winner === me && !celebrated) { celebrated = true; confetti(); }
      }
    } else {
      show = false;
    }
    $("c4Wrap").hidden = m.status === "pending" || m.status === "declined" || m.status === "cancelled";
    timerEl.hidden = m.status !== "active";
    panel.hidden = !show;
    if (!show) return;
    panel.appendChild(h);
    if (p.textContent || p.id) panel.appendChild(p);
    if (act.childNodes.length) panel.appendChild(act);
  }

  function button(label, cls, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "c4-btn" + (cls ? " " + cls : "");
    b.textContent = label;
    b.addEventListener("click", function () { b.disabled = true; fn(b); });
    return b;
  }
  function link(label, href) {
    var a = document.createElement("a");
    a.className = "c4-btn";
    a.href = href;
    a.textContent = label;
    return a;
  }

  function rematch(b) {
    sb.rpc("game_challenge", { p_opponent: opponent() }).then(function (res) {
      if (res.error) { if (b) b.disabled = false; toast(G.errText(res.error)); return; }
      location.href = G.url(res.data);
    });
  }

  /* ---------- Poteza ---------- */

  function play(col) {
    if (!myTurn() || col < 0 || col > 6) return;
    var idx = landing(m.board, col);
    if (idx < 0) { toast("Stolpec je poln."); return; }
    var before = m;
    var mark = mineSide() === "a" ? "1" : "2";
    // optimistično: žeton pade takoj, čas se ustavi
    var opt = {};
    for (var k in m) opt[k] = m[k];
    opt.board = m.board.slice(0, idx) + mark + m.board.slice(idx + 1);
    opt.moves = m.moves + 1;
    opt.last_idx = idx;
    opt.turn = opponent();
    opt.turn_deadline = null;
    busy = true;
    var prev = m;
    m = opt;
    render(prev);
    if (navigator.vibrate) navigator.vibrate(12);
    sb.rpc("game_move", { p_match: before.id, p_col: col }).then(function (res) {
      busy = false;
      if (res.error) {
        m = before;
        // počisti optimistični žeton
        var cell = cells[idx];
        if (cell.firstChild) cell.removeChild(cell.firstChild);
        render(null);
        toast(G.errText(res.error));
        refetch();
        return;
      }
      m = before; // da setState vidi pravo „prejšnje“ stanje brez ponovne animacije
      setState(res.data, true);
    });
  }

  /* ---------- Čas ---------- */

  function tick() {
    if (!m) return;
    if (m.status === "pending" && uid === m.player_a) {
      var w = $("c4Wait");
      if (w) {
        var left = Math.max(0, G.ACCEPT_MS - (Date.now() - Date.parse(m.created_at)));
        var s = Math.ceil(left / 1000);
        w.textContent = left ? "Izziv velja še " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") : "Izziv je potekel.";
        if (!left) render(m);
      }
    }
    if (m.status !== "active" || !m.turn_deadline) {
      timerEl.classList.add("is-off");
      timerFill.style.transform = "scaleX(0)";
      timerNum.textContent = "";
      return;
    }
    var total = (m.move_seconds || 8) * 1000;
    var remain = Date.parse(m.turn_deadline) - serverNow();
    var frac = Math.max(0, Math.min(1, remain / total));
    timerEl.classList.remove("is-off");
    timerEl.classList.toggle("is-low", remain <= 3000);
    timerFill.style.transform = "scaleX(" + frac.toFixed(3) + ")";
    var sec = Math.max(0, Math.ceil(remain / 1000));
    timerNum.textContent = sec + " s";

    if (m.turn === uid && sec <= 3 && sec > 0 && !buzzed[m.moves + ":" + sec]) {
      buzzed[m.moves + ":" + sec] = true;
      if (navigator.vibrate) navigator.vibrate(sec === 1 ? 80 : 25);
    }
    // rok + toleranca potekla → kateri koli igralec zahteva konec
    if (mineSide() && remain < -2500 && Date.now() - claiming > 1500) {
      claiming = Date.now();
      sb.rpc("game_timeout", { p_match: m.id }).then(function (res) {
        if (!res.error && res.data) setState(res.data, true);
      });
    }
  }

  /* ---------- Konfeti ---------- */

  function confetti() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var c = document.createElement("canvas");
    c.className = "c4-confetti";
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    document.body.appendChild(c);
    var ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    var colors = ["#f43f5e", "#facc15", "#22d3ee", "#a855f7", "#22c55e", "#ec4899"];
    var bits = [];
    for (var i = 0; i < 140; i++) {
      bits.push({
        x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .35,
        vx: (Math.random() - .5) * 12, vy: -Math.random() * 12 - 4,
        r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3,
        w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, c: colors[i % colors.length]
      });
    }
    var t0 = performance.now();
    (function frame(t) {
      var age = t - t0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      bits.forEach(function (b) {
        b.vy += .32; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - age / 2600);
        ctx.translate(b.x, b.y);
        ctx.rotate(b.r);
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.restore();
      });
      if (age < 2600) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }

  /* ---------- Predaja (dvojni tap) ---------- */

  var resignArm = 0;
  resignBtn.addEventListener("click", function () {
    if (Date.now() - resignArm > 2500) {
      resignArm = Date.now();
      resignBtn.textContent = "Res? Tapni še enkrat";
      setTimeout(function () { resignBtn.textContent = "Predaj se"; }, 2500);
      return;
    }
    resignArm = 0;
    resignBtn.disabled = true;
    sb.rpc("game_resign", { p_match: m.id }).then(function (res) {
      resignBtn.disabled = false;
      resignBtn.textContent = "Predaj se";
      if (res.error) { toast(G.errText(res.error)); return; }
      setState(res.data, true);
    });
  });

  /* ---------- Revanša od nasprotnika ---------- */

  function showRematch(n) {
    banner.innerHTML = "";
    var t = document.createElement("span");
    t.textContent = first(n.player_a) + " želi revanšo! ⚔️";
    var b = button("Sprejmi", "is-go", function (btn) {
      sb.rpc("game_respond", { p_match: n.id, p_accept: true }).then(function (res) {
        if (res.error) { btn.disabled = false; toast(G.errText(res.error)); return; }
        location.href = G.url(n.id);
      });
    });
    b.style.padding = "8px 16px";
    banner.appendChild(t);
    banner.appendChild(b);
    banner.hidden = false;
    if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
  }

  /* ---------- Nalaganje ---------- */

  function refetch() {
    return sb.rpc("game_json", { p_match: matchId }).then(function (res) {
      if (res.error) throw res.error;
      if (!res.data) throw new Error("Igra ne obstaja.");
      setState(res.data, true);
    });
  }

  function startGame() {
    $("igraTrophy").hidden = false;
    buildBoard();
    refetch().then(function () {
      gate.hidden = true;
      $("igraGame").hidden = false;
      sb.channel("igra-" + matchId)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_matches", filter: "id=eq." + matchId }, function (p) {
          if (busy) return; // odgovor RPC prinese isto stanje
          if (p.new) setState(p.new, false);
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_matches" }, function (p) {
          var n = p.new;
          if (n && n.player_b === uid && n.player_a === opponent() && n.status === "pending") showRematch(n);
        })
        .subscribe(function (status) {
          if (status === "SUBSCRIBED") refetch().catch(function () {});
        });
      setInterval(tick, 100);
      document.addEventListener("visibilitychange", function () { if (!document.hidden) refetch().catch(function () {}); });
    }).catch(function (e) {
      gate.textContent = (e && e.message) || "Igre ni mogoče naložiti.";
    });
  }

  /* =================== Lestvica =================== */

  var MEDALS = ["🥇", "🥈", "🥉"];

  function startLobby() {
    document.title = "Igre · Bitneverse";
    gate.hidden = true;
    $("igraLobby").hidden = false;
    $("lbChallenge").addEventListener("click", function () { G.challenge(people()); });

    sb.rpc("game_leaderboard", { p_game: "connect4" }).then(function (res) {
      var box = $("lbList");
      box.innerHTML = "";
      var rows = (res.data || []).filter(function (r) { return names[r.user_id]; });
      if (res.error || !rows.length) {
        var e = document.createElement("p");
        e.className = "lb-empty";
        e.textContent = res.error ? "Lestvice ni mogoče naložiti." : "Še nobena odigrana igra. Izzovi koga! ⚔️";
        box.appendChild(e);
        return;
      }
      rows.forEach(function (r, i) {
        var row = document.createElement("div");
        row.className = "lb-row is-" + (i + 1) + (r.user_id === uid ? " is-me" : "");
        var rank = document.createElement("span");
        rank.className = "lb-rank";
        rank.textContent = MEDALS[i] || String(i + 1);
        var av = document.createElement("span");
        av.className = "lb-av";
        var c = S.personColors(r.user_id);
        av.style.background = "linear-gradient(140deg," + c[0] + "," + c[1] + ")";
        av.textContent = S.initials(names[r.user_id]);
        var nm = document.createElement("span");
        nm.className = "lb-name";
        nm.textContent = r.user_id === uid ? names[r.user_id] + " (ti)" : names[r.user_id];
        var small = document.createElement("small");
        small.textContent = r.played + " iger · " + r.losses + " porazov" + (r.draws ? " · " + r.draws + " neodl." : "");
        nm.appendChild(small);
        var w = document.createElement("span");
        w.className = "lb-wins";
        w.textContent = r.wins + " 🏆";
        row.appendChild(rank);
        row.appendChild(av);
        row.appendChild(nm);
        row.appendChild(w);
        box.appendChild(row);
      });
    });

    sb.from("game_matches").select("*")
      .or("player_a.eq." + uid + ",player_b.eq." + uid)
      .order("created_at", { ascending: false }).limit(12)
      .then(function (res) {
        var box = $("lbGames");
        box.innerHTML = "";
        var list = res.data || [];
        if (!list.length) {
          var e = document.createElement("p");
          e.className = "lb-empty";
          e.textContent = "Še nisi igral/a. V klepetu tapni 🎮 ali zgoraj „Izzovi nekoga“.";
          box.appendChild(e);
          return;
        }
        list.forEach(function (g) { G.put(g); box.appendChild(G.card(g.id)); });
      });
  }

  /* =================== Zagon =================== */

  sb.auth.getSession().then(function (res) {
    var s = res && res.data && res.data.session;
    if (!s) { location.replace("./"); return; }
    uid = s.user.id;
    loadNames().then(function () {
      if (matchId) startGame(); else startLobby();
    }, function () { gate.textContent = "Ni povezave."; });
  });
  sb.auth.onAuthStateChange(function (event) {
    if (event === "SIGNED_OUT") location.replace("./");
  });
})();

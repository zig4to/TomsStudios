/* Prdoplav — telefon kot kontroler. Pošilja levo/desno/prdec v sobo (prdoplav-net.js),
   od gostitelja dobi stanje (žival, plin, življenja, faza). */
(function () {
  "use strict";

  var NET = window.PRDONET;
  var $ = function (id) { return document.getElementById(id); };
  var sb = NET.client();
  var user = null, name = "", room = null, joined = false, code = "";
  // lasten kanal za vnose (posluša ga le veliki zaslon); seja + zaporedna številka,
  // da gostitelj zavrže zakasnelo starejše sporočilo
  var inCh = null, inReady = false, SID = Math.random().toString(36).slice(2, 8), seq = 0;
  var inp = { l: false, r: false, f: false };
  var st = null, stAt = 0, hostHere = false;
  var holdStart = 0;

  function gateMsg(t) { $("gateMsg").textContent = t; }

  if (!sb) { gateMsg("Povezava s TomsStudiom ni na voljo."); return; }

  sb.auth.getSession().then(function (res) {
    var s = res && res.data && res.data.session;
    if (!s) {
      gateMsg("Za igro se najprej prijavi na plošči TomsStudia, nato znova skeniraj kodo.");
      return;
    }
    user = s.user;
    NET.myName(sb, user).then(function (n) {
      name = n;
      var c = NET.cleanCode(new URLSearchParams(location.search).get("soba"));
      if (c.length === 4) join(c);
      else findRoom();
    });
  }, function () { gateMsg("Ni povezave."); });

  /* Brez kode: odprte sobe se oglašajo v skupnem kanalu. Ena soba → takoj noter,
     več sob → izbereš po imenu gostitelja, nobene → čakaš, da se odpre. */
  var lobby = null;
  function findRoom() {
    gateMsg("Iščem odprto sobo …");
    lobby = NET.lobbyChannel(sb, user.id);
    var ch = lobby;
    ch
      .on("presence", { event: "sync" }, showRooms)
      .subscribe(function (status) {
        // v čakalni vrsti: veliki zaslon vidi, da čakaš, in ob odprtju sobe te poveže
        if (status === "SUBSCRIBED" && lobby === ch) ch.track({ wait: true, name: name, at: Date.now() });
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") gateMsg("Ni povezave. Poskušam znova …");
      });
  }
  function showRooms() {
    if (!lobby || room) return;
    var rooms = NET.openRooms(lobby), box = $("rooms");
    box.innerHTML = "";
    if (rooms.length === 1) { enter(rooms[0].code); return; }
    if (!rooms.length) {
      box.hidden = true;
      gateMsg("Si v vrsti. Ko se na velikem zaslonu odpre soba (»Telefoni kot kontrolerji« → »Odpri sobo«), te samo poveže.");
      return;
    }
    gateMsg("Odprtih je več sob. Izberi svojo:");
    rooms.forEach(function (r) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn";
      b.textContent = "Soba: " + r.name;
      var sm = document.createElement("small");
      sm.textContent = r.n === 1 ? "1 igralec" : r.n + " igralcev";
      b.appendChild(sm);
      b.addEventListener("click", function () { enter(r.code); });
      box.appendChild(b);
    });
    box.hidden = false;
  }
  function enter(c) {
    if (lobby) { try { sb.removeChannel(lobby); } catch (e) {} lobby = null; }
    history.replaceState(null, "", "?soba=" + c);
    join(c);
  }

  var joinedAt = 0;
  function leaveRoom() {
    if (room) { try { sb.removeChannel(room); } catch (e) {} }
    if (inCh) { try { sb.removeChannel(inCh); } catch (e) {} }
    inCh = null; inReady = false;
    room = null; joined = false; st = null; hostHere = false;
    history.replaceState(null, "", location.pathname);
    $("pad").hidden = true;
    $("gate").hidden = false;
  }

  function join(c) {
    code = c;
    joinedAt = Date.now();
    $("gate").hidden = true;
    $("pad").hidden = false;
    $("meName").textContent = name;
    setStatus("Povezujem se v sobo " + code + " …");
    room = NET.channel(sb, code, user.id);
    var ic = NET.inputChannel(sb, code, user.id);
    inCh = ic; inReady = false;
    ic.subscribe(function (status) {
      if (inCh !== ic) return;
      inReady = status === "SUBSCRIBED";
      if (inReady) send();
    });
    room
      .on("presence", { event: "sync" }, function () {
        hostHere = !!room.presenceState().host;
        render();
      })
      .on("broadcast", { event: NET.EV.ST }, function (m) {
        st = m.payload || null; stAt = Date.now();
        render();
      })
      .subscribe(function (status) {
        if (status === "SUBSCRIBED") {
          joined = true;
          room.track({ name: name, at: Date.now() });
          send();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          joined = false;
          setStatus("Povezava je prekinjena. Poskušam znova …", true);
        }
      });
    wake();
  }

  function send() {
    if (!joined || !room) return;
    var pl = { u: user.id, l: inp.l, r: inp.r, f: inp.f, s: SID, n: ++seq };
    (inReady && inCh ? inCh : room).send({ type: "broadcast", event: NET.EV.IN, payload: pl });
  }
  setInterval(send, 400);

  function cmd(a, t) {
    if (!joined || !room) return;
    var pl = { u: user.id, a: a };
    if (t != null) pl.t = t;
    room.send({ type: "broadcast", event: NET.EV.CMD, payload: pl });
  }

  // Tekma: gumbi v barvah splavov (v sobi in po koncu proge tapni drug splav)
  function renderTeams(mine) {
    var box = $("teams");
    var canPick = st.ts && (st.ph === "lobby" || st.ph === "end" || st.ph === "over");
    box.hidden = !canPick;
    if (!canPick) return;
    var key = st.ts + "|" + mine.t + "|" + (st.teams || []).map(function (x) { return x.n; }).join(",");
    if (box.dataset.k === key) return;
    box.dataset.k = key;
    box.innerHTML = "";
    NET.TEAMS.forEach(function (tm, i) {
      var n = st.teams && st.teams[i] ? st.teams[i].n : 0;
      var b = document.createElement("button");
      b.type = "button"; b.style.setProperty("--tc", tm.c);
      b.className = i === mine.t ? "on" : "";
      b.disabled = i !== mine.t && n >= st.ts;
      b.textContent = tm.name + " " + n + "/" + st.ts;
      b.addEventListener("click", function () { if (i !== mine.t) cmd("team", i); });
      box.appendChild(b);
    });
  }

  function setStatus(t, warn) {
    var s = $("status");
    s.textContent = t;
    s.classList.toggle("warn", !!warn);
  }

  var HEART = '<svg viewBox="0 0 24 24" fill="FILL" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';

  function render() {
    if (!room) return;
    var mine = st && st.p ? st.p.filter(function (x) { return x.u === user.id; })[0] : null;
    var act = $("act");
    act.hidden = true;
    $("controls").classList.toggle("dim", !(st && (st.ph === "play" || st.ph === "count")));

    if (!hostHere && Date.now() - stAt > 5000 && Date.now() - joinedAt > 5000) {
      // soba je zaprta (ali star naslov) → nazaj na iskanje odprte sobe
      leaveRoom();
      findRoom();
      return;
    }
    if (!hostHere && Date.now() - stAt > 3000) {
      setStatus("Povezujem se z velikim zaslonom …");
      return;
    }
    if (!st) { setStatus("Povezan. Čakam na veliki zaslon …"); return; }
    if (!mine) { setStatus("Prijavljam se v igro …"); return; }

    if (mine.w || mine.s < 0) {
      $("meAnimal").textContent = "";
      setStatus(st.ph === "play" || st.ph === "count" ? "Vožnja že teče. Pridružiš se na naslednji progi." : "Splav je poln (4 igralci). Počakaj na prosto mesto.");
      return;
    }
    var a = NET.ANIMALS[mine.s];
    var team = st.ts ? NET.TEAMS[mine.t || 0] : null;
    document.documentElement.style.setProperty("--me", a.ring);
    document.documentElement.style.setProperty("--team", team ? team.c : "transparent");
    document.body.classList.toggle("race", !!team);
    $("meAnimal").textContent = "· " + a.name + (team ? " · " + team.name + " splav" : "");
    renderTeams(mine);
    // pri tekmi: življenja in mesto svojega splava
    var myRaft = st.rafts ? st.rafts.filter(function (x) { return x.t === (mine.t || 0); })[0] : null;
    var place = st.rank ? st.rank.indexOf(mine.t || 0) + 1 : 0;
    var g = Math.max(0, Math.min(1, mine.g));
    var fill = $("gasFill");
    fill.style.width = Math.round(g * 100) + "%";
    fill.style.background = g > 0.5 ? "#a3e635" : g > 0.2 ? "#facc15" : "#f97316";

    // preostali prdci (null = neomejeno)
    var fl = $("fartsLeft");
    fl.hidden = mine.f == null || st.ph === "lobby";
    if (mine.f != null) {
      fl.textContent = (mine.f > 0 ? mine.f + " prdcev" : "brez prdcev") +
        (st.rfIn != null && st.ph === "play" ? " · +" + st.rfIn + " s" : "");
      fl.classList.toggle("low", mine.f > 0 && mine.f <= 5);
      fl.classList.toggle("out", mine.f <= 0);
    }

    var lives = "";
    var myLives = myRaft ? myRaft.lives : st.lives;
    for (var i = 0; i < (st.maxLives || 3); i++) lives += HEART.replace("FILL", i < myLives ? "#ef4444" : "rgba(255,255,255,0.15)");
    $("lives").innerHTML = st.ph === "lobby" ? "" : lives;

    if (st.ph === "lobby") {
      setStatus((team ? "Tekma! Si " + a.name.toLowerCase() + " na splavu " + team.name.toLowerCase() + "h. Tapni barvo za menjavo. Proga: " :
        "Si " + a.name.toLowerCase() + " na splavu. Proga: ") + st.lvName + " · " +
        (st.farts == null ? "neomejeno prdcev" : st.farts + " prdcev na igralca" +
          (st.rf ? ", polnjenje vsakih " + st.rf + " s" : "")) +
        (st.wt != null && st.wt !== 100 ? ", voda " + st.wt + " %" : "") +
        (st.sp != null && st.sp !== 100 ? ", vrtenje " + st.sp + " %" : "") + ". Ko so vsi notri, začni.");
      act.hidden = false; act.textContent = "Začni vožnjo"; act.dataset.a = "start";
    } else if (st.ph === "count") {
      setStatus("Pripravi se … " + st.lvName);
    } else if (st.ph === "play" && myRaft && myRaft.done) {
      setStatus("V cilju! " + myRaft.place + ". mesto. Čakamo ostale …");
    } else if (st.ph === "play" && myRaft && myRaft.out) {
      setStatus(myRaft.why === "edge" ? "Preveč ste zaostali in izpadli. Navijaj za ostale!" : "Vaš splav je izpadel. Navijaj za ostale!", true);
    } else if (st.ph === "play" && myRaft && myRaft.e) {
      setStatus("Zaostajate! Prdite naprej, še " + myRaft.e + " s", true);
    } else if (st.ph === "play") {
      setStatus(st.lvName + " · levo/desno po robu, prdec odrine splav");
    } else if (place) {
      setStatus(place === 1 ? "1. mesto! Zmaga za " + team.name.toLowerCase() + " splav!" : place + ". mesto od " + st.rank.length + ".", place !== 1 && st.ph === "over");
      act.hidden = false;
      act.textContent = st.next ? "Naslednja proga" : "Še enkrat";
      act.dataset.a = st.next ? "next" : "retry";
    } else if (st.ph === "end") {
      setStatus("Na cilju! Bravo, ekipa.");
      act.hidden = false;
      act.textContent = st.next ? "Naslednja proga" : "Ponovi progo";
      act.dataset.a = st.next ? "next" : "retry";
    } else if (st.ph === "over") {
      setStatus("Splav je razpadel.", true);
      act.hidden = false; act.textContent = "Še enkrat"; act.dataset.a = "retry";
    } else {
      setStatus("Čakam na veliki zaslon …");
    }
  }
  setInterval(render, 1000);

  $("act").addEventListener("click", function () { cmd(this.dataset.a); });

  /* ---- gumbi (več prstov hkrati) ---- */
  function bind(el, key) {
    function down(e) {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      set(key, true, el);
    }
    function up() { set(key, false, el); }
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", up);
    el.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }
  function set(key, val, el) {
    if (inp[key] === val) return;
    inp[key] = val;
    el.classList.toggle("on", val);
    if (key === "f") {
      if (val) { holdStart = Date.now(); chargeAnim(); }
      else {
        var held = Math.min(1, (Date.now() - holdStart) / 900);
        $("chargeFill").style.height = "0%";
        if (navigator.vibrate) navigator.vibrate(Math.round(30 + 90 * held));
      }
    } else if (val && navigator.vibrate) navigator.vibrate(8);
    send();
  }
  function chargeAnim() {
    if (!inp.f) return;
    var k = Math.min(1, (Date.now() - holdStart) / 900);
    $("chargeFill").style.height = Math.round(k * 100) + "%";
    requestAnimationFrame(chargeAnim);
  }
  bind($("bL"), "l");
  bind($("bR"), "r");
  bind($("bF"), "f");

  // tipkovnica (za preizkus na računalniku)
  var KEYMAP = { ArrowLeft: ["l", "bL"], ArrowRight: ["r", "bR"], ArrowUp: ["f", "bF"], Space: ["f", "bF"] };
  window.addEventListener("keydown", function (e) {
    var k = KEYMAP[e.code];
    if (!k || $("pad").hidden) return;
    e.preventDefault();
    set(k[0], true, $(k[1]));
  });
  window.addEventListener("keyup", function (e) {
    var k = KEYMAP[e.code];
    if (k) set(k[0], false, $(k[1]));
  });

  /* ---- ekran naj ostane prižgan ---- */
  var lock = null;
  function wake() {
    if (!navigator.wakeLock || lock) return;
    navigator.wakeLock.request("screen").then(function (l) {
      lock = l;
      l.addEventListener("release", function () { lock = null; });
    }).catch(function () {});
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && room) { wake(); send(); }
    if (document.hidden) { inp.l = inp.r = inp.f = false; send(); }
  });
  document.addEventListener("pointerdown", wake, { once: true });
})();

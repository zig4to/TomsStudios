/* Prdoplav — gostitelj (prdoplav.html): fizika splava, izris, tipkovnica in soba za telefone.
   Svet: x desno, y naprej po reki (navzgor po zaslonu). Splav je krog, živali stojijo na robu
   (kot phi glede na splav). „Levo“ = žival se pomakne v svojo levo, ko gleda proti sredini
   (v smeri urinega kazalca). Prdec odrine splav od živali proti sredini. */
(function () {
  "use strict";

  var NET = window.PRDONET;
  var ANIMALS = NET.ANIMALS;
  var $ = function (id) { return document.getElementById(id); };
  var cv = $("cv");
  var ctx = cv.getContext("2d");
  var W = 0, H = 0, DPR = 1, S = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    S = Math.min(W, H * 1.35) / 820;
    if (typeof R3 !== "undefined" && R3) R3.resize(W, H);
  }
  window.addEventListener("resize", resize);
  resize();

  /* =================== Proge ===================
     river: [y, sredina x, polovična širina]; ovire imajo x glede na sredino reke. */
  /* wide = koliko je reka širša od zapisane (začetne proge so najširše). */
  var LEVELS = [
    {
      name: "Prvi pljusk", len: 2600, wide: 1.3,
      river: [[0, 0, 320], [800, 60, 320], [1600, -60, 300], [2800, 0, 320]],
      rocks: [[-140, 900, 35], [150, 1700, 35]],
      logs: [],
      pools: [],
      flows: [[1200, 250, 0, 80]]
    },
    {
      name: "Lenobni potok", len: 4300, wide: 1.3,
      river: [[0, 0, 320], [600, 0, 300], [1200, 140, 260], [1800, 180, 240], [2400, -60, 250], [3000, -160, 240], [3600, 0, 270], [4600, 0, 300]],
      rocks: [[-150, 900, 40], [-20, 1500, 45], [100, 1900, 35], [-40, 2300, 50], [-130, 2700, 40], [0, 3200, 45], [140, 3450, 35]],
      logs: [],
      pools: [],
      flows: [[2000, 260, 0, 70]]
    },
    {
      name: "Račji ribnik", len: 3800, wide: 1.25,
      river: [[0, 0, 300], [700, 0, 280], [1200, 0, 420], [2000, 80, 440], [2600, 0, 280], [3200, -100, 260], [4000, 0, 300]],
      rocks: [[-200, 1500, 40], [180, 1900, 40], [0, 2300, 30], [60, 3200, 35]],
      logs: [],
      pools: [[120, 1700, 110, 0.7]],
      flows: [[2700, 250, -70, 30]]
    },
    {
      name: "Hribovita reka", len: 4200, wide: 1.25,
      river: [[0, 0, 300], [1000, 80, 280], [2000, -80, 280], [3000, 60, 280], [4400, 0, 300]],
      rocks: [[-150, 1300, 35], [140, 2700, 35]],
      logs: [], pools: [], flows: [],
      hills: [[0, 0], [500, 0], [800, 90], [1100, 90], [1350, 0], [1700, -60], [2100, -60], [2400, 50], [2700, 50], [3000, 130], [3300, 130], [3650, 30], [4400, 30]]
    },
    {
      name: "Skalni kanjon", len: 5200, wide: 1.15,
      river: [[0, 0, 300], [500, 0, 220], [1100, -150, 190], [1700, 100, 180], [2300, 250, 200], [2900, 0, 175], [3500, -200, 190], [4100, 0, 165], [4700, 150, 200], [5500, 0, 280]],
      rocks: [[90, 700, 40], [-100, 1150, 40], [100, 1500, 40], [-90, 2050, 40], [60, 2400, 35], [-130, 2520, 30], [-100, 3000, 35], [90, 3450, 40], [-80, 4000, 35], [90, 4650, 40]],
      logs: [[1300, 70, 1.1, 0], [2700, 70, 1.4, 1.5], [3750, 65, 1.6, 0.7]],
      pools: [],
      flows: [[1800, 260, -110, 20], [3250, 260, 110, 20], [4250, 300, 0, 110]]
    },
    {
      name: "Zapornice", len: 4400, wide: 1.2,
      river: [[0, 0, 300], [800, 0, 260], [1600, 100, 250], [2400, -80, 260], [3200, 60, 250], [4000, 0, 260], [4700, 0, 300]],
      rocks: [[-130, 1350, 35], [120, 2250, 35], [-100, 3150, 35]],
      logs: [], pools: [],
      flows: [[4000, 250, 0, 80]],
      gates: [[900, 6, 0], [1800, 5.5, 1.5], [2700, 5, 3], [3600, 4.5, 0.8]]
    },
    {
      name: "Hlodovina", len: 4600, wide: 1.15,
      river: [[0, 0, 300], [800, 0, 260], [1600, 120, 250], [2400, -100, 260], [3200, 80, 240], [4000, 0, 260], [4900, 0, 300]],
      rocks: [[-120, 1100, 35], [110, 2100, 35], [-90, 3500, 35]],
      logs: [[900, 70, 0.9, 0], [1700, 70, 1.0, 1], [2600, 80, 1.1, 2], [3300, 70, 1.2, 0.5], [4100, 70, 1.3, 1.7]],
      pools: [],
      flows: [[2900, 250, 0, 90]]
    },
    {
      name: "Vrtinčni slapovi", len: 6000, wide: 1.15,
      river: [[0, 0, 300], [600, 0, 240], [1200, 180, 200], [1800, -100, 175], [2400, -250, 220], [3000, 0, 165], [3600, 200, 200], [4200, 0, 160], [4800, -150, 190], [5400, 0, 175], [6300, 0, 300]],
      rocks: [[-110, 900, 35], [100, 2000, 35], [-90, 3300, 35], [90, 4500, 40], [0, 5750, 35]],
      logs: [[1700, 70, 1.3, 0], [3000, 60, 1.6, 2], [4300, 60, 1.8, 1], [5300, 70, 1.5, 0.4]],
      pools: [[60, 1400, 120, 1], [-60, 2650, 130, 1.1], [50, 3900, 110, 1.2], [-50, 5050, 120, 1.25]],
      flows: [[2150, 240, 120, 10], [3450, 240, -130, 10], [4650, 220, 130, 10]]
    },
    {
      name: "Bodičasti ovinki", len: 4800, wide: 1.15,
      river: [[0, 0, 300], [400, 0, 220], [900, -200, 190], [1400, 150, 185], [1900, -180, 190], [2400, 160, 185], [2900, -150, 190], [3400, 170, 185], [3900, -120, 190], [4400, 0, 200], [5100, 0, 280]],
      rocks: [], logs: [], pools: [],
      flows: [[2600, 250, 0, 60]],
      spikes: [[500, 4450]]
    },
    {
      name: "Velika finala", len: 6600, wide: 1.15,
      river: [[0, 0, 300], [700, 0, 250], [1400, -150, 220], [2100, 120, 220], [2800, 0, 240], [3500, -180, 220], [4200, 100, 220], [4900, 0, 230], [5600, -120, 220], [6900, 0, 300]],
      rocks: [[90, 800, 35], [-100, 1500, 35], [110, 2400, 35], [-90, 3300, 35], [100, 4500, 35], [-60, 5400, 35]],
      logs: [[1900, 70, 1.1, 0], [3800, 70, 1.3, 1], [6000, 70, 1.4, 2]],
      pools: [[-40, 2900, 110, 0.9], [50, 5000, 110, 1]],
      flows: [[1100, 240, 90, 20], [4700, 240, -100, 20], [6200, 280, 0, 100]]
    },
    {
      name: "Gorski spust", len: 6200, wide: 1.15,
      river: [[0, 0, 300], [700, 0, 240], [1400, -150, 220], [2100, 120, 220], [2800, 0, 230], [3500, -160, 210], [4200, 120, 210], [4900, 0, 220], [5600, -100, 220], [6500, 0, 300]],
      rocks: [[100, 1000, 35], [-90, 2600, 35], [90, 4700, 35]],
      logs: [[5300, 70, 1.0, 0]],
      pools: [[-40, 2200, 100, 0.8]],
      flows: [],
      hills: [[0, 0], [600, 0], [900, -80], [1200, -80], [1600, 40], [2000, 40], [2400, -60], [3000, -60], [3300, 60], [3700, 60], [4300, -100], [5000, -100], [5300, 20], [6500, 20]],
      gates: [[1800, 5.5, 0], [3800, 5, 2], [5800, 5, 1]],
      spikes: [[2900, 3600], [4400, 5000]]
    }
  ];

  /* Hribčki: višina vode (h) vzdolž reke. Navzdol splav pospeši, navzgor ga vleče nazaj. */
  function elev(lv, y) {
    var p = lv.hills;
    if (!p || !p.length) return 0;
    if (y <= p[0][0]) return p[0][1];
    for (var i = 1; i < p.length; i++) {
      if (y <= p[i][0]) {
        var a = p[i - 1], b = p[i];
        var t = (y - a[0]) / (b[0] - a[0]);
        t = t * t * (3 - 2 * t);
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    return p[p.length - 1][1];
  }
  function slopeAt(lv, y) { return (elev(lv, y + 10) - elev(lv, y - 10)) / 20; }
  function spiky(lv, y) {
    return !!lv.spikes && lv.spikes.some(function (s) { return y >= s[0] && y <= s[1]; });
  }

  function river(lv, y) {
    var p = lv.river;
    if (y <= p[0][0]) return { cx: p[0][1], hw: p[0][2] };
    for (var i = 1; i < p.length; i++) {
      if (y <= p[i][0]) {
        var a = p[i - 1], b = p[i];
        var t = (y - a[0]) / (b[0] - a[0]);
        t = t * t * (3 - 2 * t);
        return { cx: a[1] + (b[1] - a[1]) * t, hw: a[2] + (b[2] - a[2]) * t };
      }
    }
    var l = p[p.length - 1];
    return { cx: l[1], hw: l[2] };
  }

  // Ovire v svetovne koordinate (enkrat na progo).
  // Lažje: širše reke, šibkejši vrtinci in tokovi, krajši in počasnejši hlodi.
  var LOG_LEN = 0.6, LOG_SPEED = 0.5, LOG_R = 10;
  var EASY = 0.8;
  LEVELS.forEach(function (lv) {
    lv.river = lv.river.map(function (p) { return [p[0], p[1], p[2] * (lv.wide || 1.1)]; });
    lv.pools = lv.pools.map(function (p) { return [p[0], p[1], p[2], p[3] * EASY]; });
    lv.flows = lv.flows.map(function (f) { return [f[0], f[1], f[2] * EASY, f[3]]; });
    if (lv.hills) lv.hills = lv.hills.map(function (h) { return [h[0], h[1] * 2]; }); // bolj vidni hribčki
  });

  LEVELS.forEach(function (lv) {
    lv.R =lv.rocks.map(function (r) { return { x: river(lv, r[1]).cx + r[0], y: r[1], r: r[2] }; });
    lv.L = lv.logs.map(function (l) {
      var rv = river(lv, l[0]);
      // lažje: hlodi so krajši (60 %) in počasnejši (50 %)
      var half = l[1] * LOG_LEN;
      return { y: l[0], bx: rv.cx, half: half, amp: Math.max(20, rv.hw - half - 10), speed: l[2] * LOG_SPEED, ph: l[3] };
    });
    lv.P = lv.pools.map(function (p) { return { x: river(lv, p[1]).cx + p[0], y: p[1], r: p[2], str: p[3] }; });
    lv.F = lv.flows.map(function (f) { return { y: f[0], h: f[1], fx: f[2], fy: f[3] }; });
    // zapornice: [y, perioda (s), zamik] — vrata z obeh bregov se zapirajo proti sredini
    lv.Gt = (lv.gates || []).map(function (g) {
      var rv = river(lv, g[0]);
      return { y: g[0], cx: rv.cx, hw: rv.hw, period: g[1], ph: g[2], gap: rv.hw, open: 1 };
    });
  });

  /* =================== Konstante =================== */
  var RAFT = 58;            // polmer splava
  var RC = 74;              // polmer za trke (z živalmi)
  var MOVE = 2.4;           // rad/s po robu
  var MINGAP = 0.62;        // najmanjši kot med živalmi
  var CURRENT = 45;         // osnovni tok reke
  var DRAG = 0.9;
  var HIT = 130;            // hitrost udarca, ki stane življenje
  var MAXL = 5;             // življenja splava
  var SPIKE_HIT = 40;       // ob bodicah že rahel dotik stane življenje
  var GRAV = 110;           // hribčki: pospešek navzdol po klancu (višine so podvojene)
  var GATE_R = 12;          // debelina vrat zapornice

  var KEYS = [
    { l: ["KeyA"], r: ["KeyD"], f: ["KeyW"], label: ["A", "D", "W"] },
    { l: ["ArrowLeft"], r: ["ArrowRight"], f: ["ArrowUp"], label: ["←", "→", "↑"] },
    { l: ["KeyJ"], r: ["KeyL"], f: ["KeyI"], label: ["J", "L", "I"] },
    { l: ["Numpad4", "Digit4"], r: ["Numpad6", "Digit6"], f: ["Numpad8", "Digit8"], label: ["4", "6", "8"] }
  ];

  /* =================== Stanje =================== */
  var G = {
    mode: "kb",          // "kb" | "tel"
    phase: "menu",       // menu | lobby | count | play | end | over
    lv: 0, n: 2,
    time: 0,             // animacija (vedno teče)
    t: 0,                // čas vožnje
    count: 0,
    lives: 5, inv: 0, shake: 0,
    raft: null, players: [], parts: [],
    cam: { x: 0, y: 0 },
    best: null, newRecord: false
  };
  var keysDown = {};

  function loadBest() {
    try { return JSON.parse(localStorage.getItem("prdoplav-best") || "{}") || {}; } catch (e) { return {}; }
  }
  function saveBest(b) {
    try { localStorage.setItem("prdoplav-best", JSON.stringify(b)); } catch (e) {}
  }
  G.best = loadBest();

  function fmt(t) {
    var m = Math.floor(t / 60), s = t - m * 60;
    return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
  }

  function makePlayers(list) {
    var n = list.length;
    return list.map(function (src, i) {
      return {
        slot: src.slot, uid: src.uid || null, name: src.name,
        phi: -Math.PI / 2 - i * (2 * Math.PI / n),
        gas: 1, charge: 0, holding: false, puff: 0,
        inp: { l: false, r: false, f: false }, lastIn: performance.now()
      };
    });
  }

  function resetRaft(lv) {
    G.raft = { x: river(lv, 140).cx, y: 140, vx: 0, vy: 0, ang: 0, av: 0 };
    G.cam.x = G.raft.x; G.cam.y = G.raft.y + 40;
  }

  function startLevel(i) {
    G.lv = i;
    var lv = LEVELS[i];
    var list;
    if (G.mode === "tel") {
      list = tel.players.filter(function (p) { return !p.waiting; });
    } else {
      list = [];
      for (var k = 0; k < G.n; k++) list.push({ slot: k, name: "P" + (k + 1) });
    }
    G.players = makePlayers(list);
    resetRaft(lv);
    G.lives = MAXL; G.inv = 0; G.t = 0; G.parts = []; G.newRecord = false;
    G.phase = "count"; G.count = 3.2;
    showOnly(null);
    $("btnPause").hidden = false;
    sound.unlock();
    pushState(true);
  }

  /* =================== Fizika =================== */
  function waterAt(lv, x, y) {
    // tok sledi ovinkom reke in rahlo vleče proti sredini (lažje skozi ovinke)
    var rv = river(lv, y), rv2 = river(lv, y + 30);
    var wx = CURRENT * (rv2.cx - rv.cx) / 30 + (rv.cx - x) * 0.12, wy = CURRENT;
    for (var i = 0; i < lv.F.length; i++) {
      var f = lv.F[i];
      if (y > f.y && y < f.y + f.h) {
        var k = Math.sin(Math.PI * (y - f.y) / f.h);
        wx += f.fx * k; wy += f.fy * k;
      }
    }
    for (var j = 0; j < lv.P.length; j++) {
      var p = lv.P[j], dx = x - p.x, dy = y - p.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < p.r * 1.6 && d > 1) {
        var s = 110 * p.str * Math.max(0, 1 - d / (p.r * 1.6));
        wx += -dy / d * s; wy += dx / d * s;
      }
    }
    return { x: wx, y: wy };
  }

  function logX(l) { return l.bx + Math.sin(G.time * l.speed + l.ph) * l.amp; }
  function logV(l) { return Math.cos(G.time * l.speed + l.ph) * l.amp * l.speed; }

  function collide(nx, ny, pen, ovx, ovy, cx, cy, thr) {
    var r = G.raft;
    r.x += nx * pen; r.y += ny * pen;
    var rvx = r.vx - ovx, rvy = r.vy - ovy;
    var vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      r.vx -= 1.45 * vn * nx; r.vy -= 1.45 * vn * ny;
      var vt = rvx * -ny + rvy * nx;
      r.av += vt * 0.006;
      impact(-vn, cx, cy, thr);
    }
  }

  function impact(speed, x, y, thr) {
    if (speed > (thr || HIT) && G.inv <= 0 && G.phase === "play") {
      G.lives--; G.inv = 2; G.shake = 0.5;
      sound.bonk(1);
      splash(x, y, 26, thr ? "#fca5a5" : "#e0f2fe");
      if (G.lives <= 0) finish(false);
      else pushState(true);
    } else if (speed > 35) {
      sound.bonk(0.35);
      splash(x, y, 8, "#e0f2fe");
    }
  }

  function physics(dt) {
    var lv = LEVELS[G.lv], r = G.raft;
    var w = waterAt(lv, r.x, r.y);
    var k = 1 - Math.exp(-DRAG * dt);
    r.vx += (w.x - r.vx) * k; r.vy += (w.y - r.vy) * k;

    for (var i = 0; i < lv.P.length; i++) {
      var p = lv.P[i], dx = p.x - r.x, dy = p.y - r.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < p.r && d > 1) {
        var f = (1 - d / p.r) * 150 * p.str;
        r.vx += dx / d * f * dt; r.vy += dy / d * f * dt;
        r.av += 2.2 * p.str * (1 - d / p.r) * dt;
      }
    }
    // hribček: navzdol pospeši, navzgor zavira
    r.vy -= GRAV * slopeAt(lv, r.y) * dt;
    r.av *= Math.exp(-1.4 * dt);
    r.x += r.vx * dt; r.y += r.vy * dt; r.ang += r.av * dt;

    // bregova (ob bodicah boli že rahel dotik)
    var rv = river(lv, r.y), rv2 = river(lv, r.y + 10);
    var left = rv.cx - rv.hw, right = rv.cx + rv.hw;
    var thr = spiky(lv, r.y) ? SPIKE_HIT : 0;
    if (r.x - RC < left) {
      var sl = ((rv2.cx - rv2.hw) - left) / 10, ln = Math.sqrt(1 + sl * sl);
      collide(1 / ln, -sl / ln, (left - (r.x - RC)) / ln, 0, 0, r.x - RC, r.y, thr);
    }
    if (r.x + RC > right) {
      var sr = ((rv2.cx + rv2.hw) - right) / 10, rn = Math.sqrt(1 + sr * sr);
      collide(-1 / rn, sr / rn, ((r.x + RC) - right) / rn, 0, 0, r.x + RC, r.y, thr);
    }
    // zapornice: dve vrati od bregov do reže na sredini
    for (var gi = 0; gi < lv.Gt.length; gi++) {
      var gt = lv.Gt[gi];
      segHit(gt.cx - gt.hw - 20, gt.cx - gt.gap, gt.y, GATE_R);
      segHit(gt.cx + gt.gap, gt.cx + gt.hw + 20, gt.y, GATE_R);
    }
    if (r.y < 60) { r.y = 60; if (r.vy < 0) r.vy = 0; }

    // skale
    for (var j = 0; j < lv.R.length; j++) {
      var o = lv.R[j], ox = r.x - o.x, oy = r.y - o.y, od = Math.sqrt(ox * ox + oy * oy);
      if (od < RC + o.r && od > 0.01) collide(ox / od, oy / od, RC + o.r - od, 0, 0, o.x + ox / od * o.r, o.y + oy / od * o.r);
    }
    // hlodi
    for (var m = 0; m < lv.L.length; m++) {
      var l = lv.L[m], lx = logX(l);
      var px = Math.max(lx - l.half, Math.min(lx + l.half, r.x)), py = l.y;
      var qx = r.x - px, qy = r.y - py, qd = Math.sqrt(qx * qx + qy * qy);
      if (qd < RC + LOG_R && qd > 0.01) collide(qx / qd, qy / qd, RC + LOG_R - qd, logV(l), 0, px, py);
    }

    if (r.y >= lv.len && G.phase === "play") finish(true);
  }

  function segHit(x0, x1, y, rad) {
    if (x1 <= x0) return;
    var r = G.raft;
    var px = Math.max(x0, Math.min(x1, r.x));
    var qx = r.x - px, qy = r.y - y, qd = Math.sqrt(qx * qx + qy * qy);
    if (qd < RC + rad && qd > 0.01) collide(qx / qd, qy / qd, RC + rad - qd, 0, 0, px, y);
  }

  // Zapornice se odpirajo in zapirajo. Senzor: dokler je splav v vratih, se ne zapirajo naprej.
  function updateGates(dt) {
    var lv = LEVELS[G.lv], r = G.raft;
    lv.Gt.forEach(function (g) {
      g.open = Math.max(0, Math.min(1, 0.5 + 0.9 * Math.sin(2 * Math.PI * G.time / g.period + g.ph)));
      var target = 4 + g.open * (g.hw - 4);
      if (r && Math.abs(r.y - g.y) < RC + GATE_R + 6 && target < g.gap) target = g.gap;
      var sp = 150 * dt;
      g.gap += Math.max(-sp, Math.min(sp, target - g.gap));
    });
  }

  function angDist(a, b) {
    var d = (a - b) % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    return Math.abs(d);
  }

  function updatePlayers(dt, canFart) {
    var now = performance.now();
    G.players.forEach(function (p) {
      if (G.mode === "kb") {
        var k = KEYS[p.slot];
        p.inp.l = k.l.some(function (c) { return keysDown[c]; });
        p.inp.r = k.r.some(function (c) { return keysDown[c]; });
        p.inp.f = k.f.some(function (c) { return keysDown[c]; });
      } else if (now - p.lastIn > 2500) {
        p.inp.l = p.inp.r = p.inp.f = false;
      }
      var d = (p.inp.r ? 1 : 0) - (p.inp.l ? 1 : 0);
      if (d) {
        var np = p.phi + d * MOVE * dt; // levo = v smeri urinega kazalca (žival gleda proti sredini)
        var blocked = G.players.some(function (o) { return o !== p && angDist(o.phi, np) < MINGAP && angDist(o.phi, np) < angDist(o.phi, p.phi); });
        if (!blocked) p.phi = np;
      }
      if (canFart) {
        if (p.inp.f) p.charge = Math.min(1, p.charge + dt / 0.9);
        else if (p.holding) fart(p);
        p.holding = p.inp.f;
      } else { p.holding = false; p.charge = 0; }
      p.gas = Math.min(1, p.gas + dt * 0.3);
      p.puff = Math.max(0, p.puff - dt);
    });
  }

  function animalPos(p) {
    var a = G.raft.ang + p.phi;
    return { a: a, x: G.raft.x + Math.cos(a) * RAFT, y: G.raft.y + Math.sin(a) * RAFT };
  }

  function fart(p) {
    var c = p.charge;
    p.charge = 0;
    var cost = 0.16 + 0.34 * c;
    var k = p.gas >= cost ? 1 : Math.max(0, p.gas / cost);
    p.gas = Math.max(0, p.gas - cost);
    var pos = animalPos(p), cos = Math.cos(pos.a), sin = Math.sin(pos.a);
    if (k < 0.15) {
      puffs(pos.x + cos * 12, pos.y + sin * 12, cos, sin, 3, 0.2);
      sound.fart(0.05);
      return;
    }
    var power = (70 + 160 * c) * k; // prej 110 + 250 * c — prdec premakne manj
    G.raft.vx -= cos * power; G.raft.vy -= sin * power;
    G.raft.av += (Math.random() - 0.5) * 0.4 * c;
    p.puff = 0.35;
    puffs(pos.x + cos * 12, pos.y + sin * 12, cos, sin, Math.round(8 + 22 * c * k), 0.4 + c * k);
    sound.fart(Math.max(0.2, c * k));
    sendBuzz(p);
  }

  /* =================== Delci =================== */
  var PUFF = ["#bef264", "#a3e635", "#d9f99d", "#84cc16", "#ca8a04"];
  function puffs(x, y, dx, dy, n, s) {
    for (var i = 0; i < n; i++) {
      var sp = (60 + 180 * s) * (0.5 + Math.random());
      var ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.1;
      G.parts.push({
        x: x, y: y, vx: Math.cos(ang) * sp + G.raft.vx * 0.3, vy: Math.sin(ang) * sp + G.raft.vy * 0.3,
        life: 0, max: 0.7 + Math.random() * 0.8, r: 6 + Math.random() * 10 * (0.6 + s), col: PUFF[i % PUFF.length], grow: 1
      });
    }
  }
  function splash(x, y, n, col) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 140;
      G.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.4 + Math.random() * 0.4, r: 2 + Math.random() * 4, col: col, grow: 0 });
    }
  }
  function updateParts(dt) {
    for (var i = G.parts.length - 1; i >= 0; i--) {
      var p = G.parts[i];
      p.life += dt;
      if (p.life >= p.max) { G.parts.splice(i, 1); continue; }
      var dr = Math.exp(-2.2 * dt);
      p.vx *= dr; p.vy *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    if (G.parts.length > 600) G.parts.splice(0, G.parts.length - 600);
  }

  /* =================== Zvok (Web Audio, brez datotek) =================== */
  var sound = (function () {
    var ac = null, noise = null;
    function unlock() {
      if (!ac) {
        try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
        var len = ac.sampleRate;
        noise = ac.createBuffer(1, len, ac.sampleRate);
        var d = noise.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === "suspended") ac.resume();
    }
    function fart(p) {
      if (!ac) return;
      var t = ac.currentTime, dur = 0.18 + 0.55 * p;
      var g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35 + 0.35 * p, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g.connect(ac.destination);

      var o = ac.createOscillator();
      o.type = "sawtooth";
      var base = 95 - 35 * p + Math.random() * 25;
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 0.55, t + dur);
      var lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = 18 + Math.random() * 14;
      lg.gain.value = base * 0.35;
      lfo.connect(lg); lg.connect(o.frequency);
      var lp = ac.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 500 + 400 * p;
      o.connect(lp); lp.connect(g);

      var n = ac.createBufferSource(), bp = ac.createBiquadFilter(), ng = ac.createGain();
      n.buffer = noise; bp.type = "bandpass"; bp.frequency.value = 260; bp.Q.value = 0.9;
      ng.gain.value = 0.5;
      n.connect(bp); bp.connect(ng); ng.connect(g);

      o.start(t); lfo.start(t); n.start(t);
      o.stop(t + dur); lfo.stop(t + dur); n.stop(t + dur);
    }
    function bonk(p) {
      if (!ac) return;
      var t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
      g.gain.setValueAtTime(0.5 * p, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + 0.3);
    }
    function tune(notes) {
      if (!ac) return;
      var t = ac.currentTime;
      notes.forEach(function (f, i) {
        var o = ac.createOscillator(), g = ac.createGain(), s = t + i * 0.13;
        o.type = "square"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.12, s + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.22);
        o.connect(g); g.connect(ac.destination);
        o.start(s); o.stop(s + 0.24);
      });
    }
    return { unlock: unlock, fart: fart, bonk: bonk, tune: tune };
  })();

  /* =================== Konec proge =================== */
  function finish(won) {
    G.phase = won ? "end" : "over";
    var lv = LEVELS[G.lv];
    $("btnPause").hidden = true;
    if (won) {
      var prev = G.best[lv.name];
      G.newRecord = !prev || G.t < prev;
      if (G.newRecord) { G.best[lv.name] = G.t; saveBest(G.best); }
      sound.tune([523, 659, 784, 1047]);
      $("endTitle").textContent = "Na cilju!";
      $("endTime").textContent = fmt(G.t);
      $("endInfo").innerHTML = G.newRecord ? '<span class="rec">Nov rekord za progo ' + lv.name + "!</span>"
        : "Rekord: " + fmt(prev);
    } else {
      sound.tune([392, 330, 262, 196]);
      $("endTitle").textContent = "Splav je razpadel";
      $("endTime").textContent = Math.round(Math.min(1, G.raft.y / lv.len) * 100) + " % proge";
      $("endInfo").textContent = "Splav je dobil preveč udarcev. Še enkrat?";
    }
    var hasNext = won && G.lv < LEVELS.length - 1;
    $("btnNext").hidden = !hasNext;
    $("btnRetry").textContent = won ? "Ponovi" : "Še enkrat";
    if (G.mode === "tel") tel.admitWaiting();
    setTimeout(function () { if (G.phase === "end" || G.phase === "over") showOnly("end"); }, won ? 900 : 1100);
    pushState(true);
    renderLevels();
  }

  /* =================== Izris =================== */
  function sx(x) { return W / 2 + (x - G.cam.x) * S + shX; }
  function sy(y) { return H * 0.6 - (y - G.cam.y) * S + shY; }
  var shX = 0, shY = 0;

  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  function draw() {
    var lv = LEVELS[G.lv];
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    shX = shY = 0;
    if (G.shake > 0) { shX = (Math.random() - 0.5) * 16 * G.shake; shY = (Math.random() - 0.5) * 16 * G.shake; }

    ctx.fillStyle = "#3f8f3a";
    ctx.fillRect(0, 0, W, H);

    var yTop = G.cam.y + (H * 0.6) / S + 80;
    var yBot = G.cam.y - (H * 0.4) / S - 80;
    var step = 24, y;

    // trava in grmi
    var g0 = Math.floor(yBot / 70) * 70;
    for (y = g0; y < yTop; y += 70) {
      var rv = river(lv, y);
      for (var side = -1; side <= 1; side += 2) {
        for (var q = 0; q < 3; q++) {
          var h = hash(y * 0.13 + side * 7 + q * 31);
          var bx = rv.cx + side * (rv.hw + 50 + h * 320 + q * 120);
          var by = y + hash(y + q) * 60;
          var br = (12 + hash(y * 3 + q + side) * 20) * S;
          ctx.fillStyle = q === 1 ? "#2f6f2d" : "#356f2c";
          ctx.beginPath(); ctx.arc(sx(bx), sy(by), br, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(190, 242, 100, 0.25)";
          ctx.beginPath(); ctx.arc(sx(bx) - br * 0.3, sy(by) - br * 0.3, br * 0.45, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // pesek ob bregu + voda
    riverPath(lv, yBot, yTop, step, 16);
    ctx.fillStyle = "#e7cf96"; ctx.fill();
    riverPath(lv, yBot, yTop, step, 0);
    var grd = ctx.createLinearGradient(0, 0, W, 0);
    grd.addColorStop(0, "#2f86cf"); grd.addColorStop(0.5, "#3b9ae1"); grd.addColorStop(1, "#2f86cf");
    ctx.fillStyle = grd; ctx.fill();

    // črte toka
    ctx.save();
    riverPath(lv, yBot, yTop, step, 0); ctx.clip();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 2 * S; ctx.lineCap = "round";
    var off = (G.time * 60) % 90;
    for (y = Math.floor(yBot / 90) * 90; y < yTop; y += 90) {
      var r2 = river(lv, y);
      for (var s = 0; s < 4; s++) {
        var hx = hash(y * 0.7 + s * 13);
        var lx = r2.cx + (hx * 2 - 1) * r2.hw * 0.85, ly = y + off + hash(s + y) * 40;
        ctx.beginPath(); ctx.moveTo(sx(lx), sy(ly)); ctx.lineTo(sx(lx), sy(ly + 26)); ctx.stroke();
      }
    }
    // tokovi (puščice)
    lv.F.forEach(function (f) {
      if (f.y > yTop || f.y + f.h < yBot) return;
      var a = Math.atan2(f.fy + CURRENT, f.fx);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.32)"; ctx.lineWidth = 3 * S;
      for (var yy = f.y + 30; yy < f.y + f.h - 20; yy += 60) {
        var rr = river(lv, yy), sh = ((G.time * 50) % 60);
        for (var xx = -1; xx <= 1; xx++) {
          var cx = rr.cx + xx * rr.hw * 0.55 + Math.cos(a) * (sh - 30), cy = yy + Math.sin(a) * (sh - 30);
          chevron(sx(cx), sy(cy), -a, 12 * S);
        }
      }
    });
    // hribčki: navzgor temneje, navzdol svetlo s peno
    if (lv.hills) {
      for (y = Math.floor(yBot / step) * step; y < yTop; y += step) {
        var sl2 = slopeAt(lv, y + step / 2);
        if (Math.abs(sl2) < 0.03) continue;
        var rh = river(lv, y), rh2 = river(lv, y + step);
        ctx.fillStyle = sl2 > 0 ? "rgba(8, 30, 60, " + Math.min(0.35, sl2 * 0.9) + ")"
          : "rgba(255, 255, 255, " + Math.min(0.35, -sl2 * 0.9) + ")";
        ctx.beginPath();
        ctx.moveTo(sx(rh.cx - rh.hw), sy(y)); ctx.lineTo(sx(rh.cx + rh.hw), sy(y));
        ctx.lineTo(sx(rh2.cx + rh2.hw), sy(y + step)); ctx.lineTo(sx(rh2.cx - rh2.hw), sy(y + step));
        ctx.closePath(); ctx.fill();
        if (sl2 < -0.12 && Math.floor(y / step) % 3 === 0) {
          ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 3 * S;
          for (var fx = -2; fx <= 2; fx++) chevron(sx(rh.cx + fx * rh.hw * 0.35), sy(y + ((G.time * 80) % step)), -Math.PI / 2, 10 * S);
        }
      }
    }
    // vrtinci
    lv.P.forEach(function (p) {
      if (p.y - p.r > yTop || p.y + p.r < yBot) return;
      var px = sx(p.x), py = sy(p.y), pr = p.r * S;
      var rg = ctx.createRadialGradient(px, py, 0, px, py, pr);
      rg.addColorStop(0, "rgba(8, 47, 73, 0.75)"); rg.addColorStop(1, "rgba(8, 47, 73, 0)");
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"; ctx.lineWidth = 2.5 * S;
      for (var k = 0; k < 4; k++) {
        var rot = -G.time * 2.2 * p.str + k * Math.PI / 2;
        ctx.beginPath(); ctx.arc(px, py, pr * (0.3 + k * 0.17), rot, rot + 2.2); ctx.stroke();
      }
    });
    ctx.restore();

    // start in cilj
    band(lv, 40, "#a16207", "#854d0e");
    finishLine(lv);

    // bodice ob bregovih
    (lv.spikes || []).forEach(function (sp) {
      var a0 = Math.max(sp[0], Math.floor(yBot / 28) * 28), a1 = Math.min(sp[1], yTop);
      for (var yy = a0; yy <= a1; yy += 28) {
        var rs = river(lv, yy);
        [-1, 1].forEach(function (side) {
          var bx = rs.cx + side * rs.hw;
          ctx.fillStyle = "#cbd5e1"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.5 * S;
          ctx.beginPath();
          ctx.moveTo(sx(bx + side * 6), sy(yy - 11)); ctx.lineTo(sx(bx - side * 20), sy(yy)); ctx.lineTo(sx(bx + side * 6), sy(yy + 11));
          ctx.closePath(); ctx.fill(); ctx.stroke();
        });
      }
    });

    // zapornice
    lv.Gt.forEach(function (g) {
      if (g.y - 40 > yTop || g.y + 40 < yBot) return;
      var gy = sy(g.y), th = GATE_R * S;
      [[g.cx - g.hw - 20, g.cx - g.gap], [g.cx + g.gap, g.cx + g.hw + 20]].forEach(function (seg) {
        if (seg[1] <= seg[0]) return;
        var x0 = sx(seg[0]), x1 = sx(seg[1]);
        ctx.fillStyle = "#dc2626"; roundRect(x0, gy - th, x1 - x0, th * 2, 4 * S); ctx.fill();
        ctx.save(); roundRect(x0, gy - th, x1 - x0, th * 2, 4 * S); ctx.clip();
        ctx.fillStyle = "#f8fafc";
        for (var xs = x0 - 40 * S; xs < x1; xs += 28 * S) {
          ctx.beginPath(); ctx.moveTo(xs, gy + th); ctx.lineTo(xs + 12 * S, gy - th); ctx.lineTo(xs + 24 * S, gy - th); ctx.lineTo(xs + 12 * S, gy + th); ctx.fill();
        }
        ctx.restore();
      });
      [g.cx - g.hw - 24, g.cx + g.hw + 24].forEach(function (px) {
        ctx.fillStyle = "#374151"; ctx.beginPath(); ctx.arc(sx(px), gy, 16 * S, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = g.open > 0.5 ? "#22c55e" : "#ef4444";
        ctx.beginPath(); ctx.arc(sx(px), gy, 8 * S, 0, Math.PI * 2); ctx.fill();
      });
    });

    // skale
    lv.R.forEach(function (o) {
      if (o.y - o.r > yTop || o.y + o.r < yBot) return;
      var ox = sx(o.x), oy = sy(o.y), or = o.r * S;
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.beginPath(); ctx.arc(ox, oy, or * (1.15 + 0.05 * Math.sin(G.time * 3 + o.y)), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#6b7280"; ctx.beginPath(); ctx.arc(ox, oy, or, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#9ca3af"; ctx.beginPath(); ctx.arc(ox - or * 0.25, oy - or * 0.25, or * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#d1d5db"; ctx.beginPath(); ctx.arc(ox - or * 0.38, oy - or * 0.4, or * 0.2, 0, Math.PI * 2); ctx.fill();
    });
    // hlodi
    lv.L.forEach(function (l) {
      if (l.y - 30 > yTop || l.y + 30 < yBot) return;
      var lx = logX(l), x0 = sx(lx - l.half), x1 = sx(lx + l.half), ly = sy(l.y), th = LOG_R * S;
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      roundRect(x0 - 6 * S, ly - th - 5 * S, x1 - x0 + 12 * S, (th + 5 * S) * 2, th + 5 * S); ctx.fill();
      ctx.fillStyle = "#7c4a1e"; roundRect(x0, ly - th, x1 - x0, th * 2, th); ctx.fill();
      ctx.strokeStyle = "#5b3410"; ctx.lineWidth = 2 * S;
      ctx.beginPath(); ctx.moveTo(x0 + th, ly - th * 0.3); ctx.lineTo(x1 - th, ly - th * 0.3); ctx.stroke();
      ctx.fillStyle = "#c08a52";
      ctx.beginPath(); ctx.ellipse(x1 - th * 0.4, ly, th * 0.45, th * 0.85, 0, 0, Math.PI * 2); ctx.fill();
    });

    drawParts(false);
    drawRaft();
    drawParts(true);
    drawHud(lv);
  }

  /* =================== 3D izris (prdoplav3d.js + Three.js, naloži se ob izbiri) =================== */
  var R3 = null, view = "2d", loading3d = false;
  var cv3 = $("cv3");

  window.PRDOPLAV = {
    G: G, LEVELS: LEVELS, ANIMALS: ANIMALS, RAFT: RAFT, CURRENT: CURRENT,
    river: river, logX: logX, elev: elev, slopeAt: slopeAt, GATE_R: GATE_R, LOG_R: LOG_R
  };

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function setView(v) {
    try { localStorage.setItem("prdoplav-view", v); } catch (e) {}
    renderViewPick(v);
    if (v === "2d") { view = "2d"; cv3.hidden = true; return; }
    if (R3) { view = "3d"; cv3.hidden = false; R3.resize(W, H); return; }
    if (loading3d) return;
    loading3d = true;
    $("viewNote").hidden = false; $("viewNote").textContent = "Nalagam 3D …";
    var p = window.THREE ? Promise.resolve() : loadScript("https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js");
    p.then(function () { return window.PRDO3D ? null : loadScript("prdoplav3d.js"); })
      .then(function () {
        R3 = window.PRDO3D.create(cv3, window.PRDOPLAV);
        if (!R3) throw new Error("webgl");
        R3.resize(W, H);
        view = "3d"; cv3.hidden = false;
        $("viewNote").hidden = true;
      })
      .catch(function () {
        view = "2d"; cv3.hidden = true;
        renderViewPick("2d");
        $("viewNote").hidden = false;
        $("viewNote").textContent = "3D na tej napravi ne deluje, igra teče v 2D.";
      })
      .then(function () { loading3d = false; });
  }

  function renderViewPick(v) {
    Array.prototype.forEach.call($("viewPick").children, function (b) {
      b.classList.toggle("on", b.getAttribute("data-v") === v);
    });
  }

  function draw3d(dt) {
    var lv = LEVELS[G.lv];
    R3.render(dt);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // imena nad živalmi
    G.players.forEach(function (p) {
      var a = G.raft.ang + p.phi;
      var pt = R3.project(G.raft.x + Math.cos(a) * RAFT, G.raft.y + Math.sin(a) * RAFT, R3.animalTop(p));
      if (pt.front) nameTag(p, pt.x, pt.y, 1.15);
    });
    drawHud(lv);
  }

  function chevron(x, y, a, s) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(-s * 0.6, -s); ctx.lineTo(s * 0.5, 0); ctx.lineTo(-s * 0.6, s); ctx.stroke();
    ctx.restore();
  }

  function riverPath(lv, y0, y1, step, extra) {
    ctx.beginPath();
    var y, rv;
    for (y = y0; y <= y1; y += step) { rv = river(lv, y); ctx.lineTo(sx(rv.cx - rv.hw - extra), sy(y)); }
    for (y = y1; y >= y0; y -= step) { rv = river(lv, y); ctx.lineTo(sx(rv.cx + rv.hw + extra), sy(y)); }
    ctx.closePath();
  }

  function band(lv, y, c1, c2) {
    var rv = river(lv, y);
    var x0 = sx(rv.cx - rv.hw - 30), x1 = sx(rv.cx + rv.hw + 30), yy = sy(y);
    if (yy < -60 || yy > H + 60) return;
    ctx.fillStyle = c1; ctx.fillRect(x0, yy - 10 * S, x1 - x0, 40 * S);
    ctx.strokeStyle = c2; ctx.lineWidth = 2 * S;
    for (var x = x0; x < x1; x += 22 * S) { ctx.beginPath(); ctx.moveTo(x, yy - 10 * S); ctx.lineTo(x, yy + 30 * S); ctx.stroke(); }
  }

  function finishLine(lv) {
    var y = lv.len, rv = river(lv, y), yy = sy(y);
    if (yy < -120 || yy > H + 60) return;
    var x0 = sx(rv.cx - rv.hw), x1 = sx(rv.cx + rv.hw), c = 18 * S;
    for (var i = 0, x = x0; x < x1; x += c, i++) {
      for (var j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? "#111827" : "#f8fafc";
        ctx.fillRect(x, yy - c * (j + 1), Math.min(c, x1 - x), c);
      }
    }
    [x0 - 14 * S, x1 + 14 * S].forEach(function (fx, k) {
      ctx.fillStyle = "#78350f"; ctx.fillRect(fx - 2 * S, yy - 70 * S, 4 * S, 72 * S);
      ctx.fillStyle = k ? "#ef4444" : "#facc15";
      ctx.beginPath(); ctx.moveTo(fx, yy - 70 * S); ctx.lineTo(fx + (k ? -1 : 1) * 30 * S, yy - 60 * S); ctx.lineTo(fx, yy - 50 * S); ctx.fill();
    });
    ctx.fillStyle = "#fff"; ctx.font = "900 " + Math.round(26 * S) + "px Outfit, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("CILJ", (x0 + x1) / 2, yy - 2 * c - 6 * S);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawParts(top) {
    G.parts.forEach(function (p) {
      if (!!p.grow !== top) return;
      var k = p.life / p.max;
      ctx.globalAlpha = (1 - k) * (p.grow ? 0.75 : 0.9);
      ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), p.r * S * (p.grow ? 1 + k * 1.6 : 1), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawRaft() {
    var r = G.raft, rx = sx(r.x), ry = sy(r.y), R = RAFT * S;
    if (G.inv > 0 && Math.floor(G.inv * 10) % 2 === 0) ctx.globalAlpha = 0.55;
    // val okoli
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; ctx.lineWidth = 3 * S;
    ctx.beginPath(); ctx.arc(rx, ry, R * 1.18 + Math.sin(G.time * 4) * 2 * S, 0, Math.PI * 2); ctx.stroke();

    ctx.save(); ctx.translate(rx, ry); ctx.rotate(-r.ang);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)"; ctx.beginPath(); ctx.arc(4 * S, 6 * S, R * 1.05, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.clip();
    var pw = R * 2 / 6;
    for (var i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? "#b7791f" : "#a16207";
      ctx.fillRect(-R + i * pw, -R, pw, R * 2);
      ctx.strokeStyle = "#78350f"; ctx.lineWidth = 2 * S;
      ctx.strokeRect(-R + i * pw, -R, pw, R * 2);
    }
    ctx.restore();
    ctx.strokeStyle = "#e2c48a"; ctx.lineWidth = 5 * S;
    ctx.beginPath(); ctx.arc(0, 0, R - 3 * S, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#78350f"; ctx.lineWidth = 2 * S;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;

    G.players.forEach(function (p) {
      var a = r.ang + p.phi;
      var ax = rx + Math.cos(a) * R, ay = ry - Math.sin(a) * R;
      var face = Math.atan2(Math.sin(a), -Math.cos(a)); // proti sredini (zaslon)
      drawAnimal(p, ax, ay, face);
    });
    G.players.forEach(function (p) {
      var a = r.ang + p.phi;
      var tx = rx + Math.cos(a) * (R + 40 * S), ty = ry - Math.sin(a) * (R + 40 * S);
      nameTag(p, tx, ty);
    });
  }

  function drawAnimal(p, x, y, face) {
    var u = 13 * S, an = ANIMALS[p.slot].key;
    var swell = 1 + 0.18 * p.charge + (p.holding ? Math.sin(G.time * 40) * 0.03 * p.charge : 0);
    ctx.save(); ctx.translate(x, y); ctx.rotate(face);

    // obroč igralca
    ctx.strokeStyle = ANIMALS[p.slot].ring; ctx.lineWidth = 3.5 * S;
    ctx.beginPath(); ctx.arc(0, 0, u * 1.7, 0, Math.PI * 2); ctx.stroke();

    // nabira se oblak
    if (p.charge > 0.05) {
      ctx.fillStyle = "rgba(190, 242, 100, " + (0.25 + 0.45 * p.charge) + ")";
      ctx.beginPath(); ctx.arc(-u * 1.5, 0, u * (0.5 + 1.1 * p.charge), 0, Math.PI * 2); ctx.fill();
    }
    ctx.scale(1, swell);
    var body, head, dark = "#1f2937";
    if (an === "krava") { body = "#f8fafc"; head = "#f8fafc"; }
    else if (an === "pujs") { body = "#f9a8d4"; head = "#f9a8d4"; }
    else if (an === "koza") { body = "#d6b98c"; head = "#e7d3ad"; }
    else { body = "#fde047"; head = "#fde047"; }

    // rep / perje
    ctx.strokeStyle = an === "pujs" ? "#ec4899" : dark; ctx.lineWidth = 2 * S;
    if (an === "pujs") { ctx.beginPath(); ctx.arc(-u * 1.45, 0, u * 0.3, 0, Math.PI * 1.6); ctx.stroke(); }
    else if (an !== "raca") { ctx.beginPath(); ctx.moveTo(-u * 1.2, 0); ctx.lineTo(-u * 1.7, u * 0.2); ctx.stroke(); }

    ctx.fillStyle = body; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1.5 * S;
    ctx.beginPath(); ctx.ellipse(0, 0, u * 1.25, u * (an === "raca" ? 1.05 : 0.9), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (an === "krava") {
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(-u * 0.4, -u * 0.35, u * 0.35, u * 0.25, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(u * 0.3, u * 0.4, u * 0.3, u * 0.22, -0.4, 0, Math.PI * 2); ctx.fill();
    }
    if (an === "raca") {
      ctx.fillStyle = "#facc15";
      ctx.beginPath(); ctx.ellipse(-u * 0.2, -u * 0.75, u * 0.7, u * 0.28, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-u * 0.2, u * 0.75, u * 0.7, u * 0.28, -0.2, 0, Math.PI * 2); ctx.fill();
    }
    // glava
    var hx = u * (an === "raca" ? 1.0 : 1.25), hr = u * (an === "raca" ? 0.62 : 0.68);
    if (an === "pujs" || an === "krava" || an === "koza") {
      ctx.fillStyle = an === "pujs" ? "#f472b6" : head;
      [-1, 1].forEach(function (s) {
        ctx.beginPath(); ctx.ellipse(hx - u * 0.25, s * u * 0.6, u * 0.32, u * 0.16, s * 0.6, 0, Math.PI * 2); ctx.fill();
      });
    }
    if (an === "krava" || an === "koza") {
      ctx.strokeStyle = an === "koza" ? "#6b4f2a" : "#e7d3ad"; ctx.lineWidth = 2.5 * S;
      [-1, 1].forEach(function (s) {
        ctx.beginPath(); ctx.moveTo(hx - u * 0.1, s * u * 0.3);
        ctx.quadraticCurveTo(hx - u * 0.6, s * u * 0.55, hx - u * 0.75, s * u * 0.25); ctx.stroke();
      });
    }
    ctx.fillStyle = head; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1.5 * S;
    ctx.beginPath(); ctx.arc(hx, 0, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (an === "krava") { ctx.fillStyle = "#fbcfe8"; ctx.beginPath(); ctx.ellipse(hx + hr * 0.7, 0, hr * 0.45, hr * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
    if (an === "pujs") {
      ctx.fillStyle = "#f472b6"; ctx.beginPath(); ctx.ellipse(hx + hr * 0.75, 0, hr * 0.35, hr * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#9d174d";
      ctx.beginPath(); ctx.arc(hx + hr * 0.8, -hr * 0.18, hr * 0.09, 0, Math.PI * 2); ctx.arc(hx + hr * 0.8, hr * 0.18, hr * 0.09, 0, Math.PI * 2); ctx.fill();
    }
    if (an === "koza") { ctx.fillStyle = "#8b6b3e"; ctx.beginPath(); ctx.ellipse(hx + hr * 0.9, 0, hr * 0.3, hr * 0.18, 0, 0, Math.PI * 2); ctx.fill(); }
    if (an === "raca") {
      ctx.fillStyle = "#fb923c";
      ctx.beginPath(); ctx.ellipse(hx + hr * 0.95, 0, hr * 0.55, hr * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(hx + hr * 0.3, -hr * 0.42, hr * 0.13, 0, Math.PI * 2); ctx.arc(hx + hr * 0.3, hr * 0.42, hr * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function nameTag(p, x, y, big) {
    var label = G.mode === "tel" ? (p.name || "").split(/\s+/)[0] : "P" + (p.slot + 1);
    var fs = Math.max(12, Math.round(14 * S * (big || 1)));
    ctx.font = "800 " + fs + "px Outfit, sans-serif";
    var w = ctx.measureText(label).width + fs;
    ctx.fillStyle = ANIMALS[p.slot].ring;
    roundRect(x - w / 2, y - fs * 0.8, w, fs * 1.6, fs * 0.8); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, x, y + 1);
  }

  function heart(x, y, s, full) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.65, x, y + s * 0.85, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.85, x + s * 0.5, y + s * 0.65, x + s * 0.5, y + s * 0.35);
    ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.35);
    ctx.fillStyle = full ? "#ef4444" : "rgba(0,0,0,0.35)"; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  }

  function drawHud(lv) {
    if (G.phase === "menu" || G.phase === "lobby") return;
    var u = Math.max(0.8, Math.min(W, H * 1.5) / 1000);
    var pad = 16 * u;
    // proga + napredek
    ctx.fillStyle = "rgba(0,0,0,0.4)"; roundRect(pad, pad, 260 * u, 58 * u, 14 * u); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.font = "800 " + Math.round(18 * u) + "px Outfit, sans-serif";
    ctx.fillText(lv.name, pad + 14 * u, pad + 9 * u);
    var prog = Math.max(0, Math.min(1, G.raft.y / lv.len));
    ctx.fillStyle = "rgba(255,255,255,0.2)"; roundRect(pad + 14 * u, pad + 36 * u, 232 * u, 10 * u, 5 * u); ctx.fill();
    ctx.fillStyle = "#a3e635"; roundRect(pad + 14 * u, pad + 36 * u, Math.max(10 * u, 232 * u * prog), 10 * u, 5 * u); ctx.fill();
    // čas
    ctx.textAlign = "center"; ctx.font = "900 " + Math.round(38 * u) + "px Outfit, sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillText(fmt(G.t), W / 2 + 2, pad + 2);
    ctx.fillStyle = "#fff"; ctx.fillText(fmt(G.t), W / 2, pad);
    // življenja
    for (var i = 0; i < MAXL; i++) heart(W - 130 - 20 * u - i * 40 * u, pad + 12 * u, 30 * u, i < G.lives); // levo od gumbov v kotu

    // igralci spodaj
    var n = G.players.length, cw = Math.min(240 * u, (W - pad * 2 - (n - 1) * 10) / n), ch = 54 * u;
    var x0 = W / 2 - (n * cw + (n - 1) * 10) / 2, y0 = H - ch - pad;
    G.players.forEach(function (p, k) {
      var x = x0 + k * (cw + 10);
      ctx.fillStyle = "rgba(0,0,0,0.45)"; roundRect(x, y0, cw, ch, 14 * u); ctx.fill();
      ctx.fillStyle = ANIMALS[p.slot].ring; roundRect(x, y0, 8 * u, ch, 4 * u); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.font = "800 " + Math.round(16 * u) + "px Outfit, sans-serif";
      var nm = G.mode === "tel" ? p.name : "P" + (p.slot + 1) + " · " + KEYS[p.slot].label.join(" ");
      ctx.fillText(fit(nm, cw - 30 * u), x + 18 * u, y0 + 8 * u);
      ctx.fillStyle = "rgba(255,255,255,0.18)"; roundRect(x + 18 * u, y0 + 32 * u, cw - 32 * u, 12 * u, 6 * u); ctx.fill();
      ctx.fillStyle = p.gas > 0.5 ? "#a3e635" : p.gas > 0.2 ? "#facc15" : "#f97316";
      roundRect(x + 18 * u, y0 + 32 * u, Math.max(12 * u, (cw - 32 * u) * p.gas), 12 * u, 6 * u); ctx.fill();
      if (G.mode === "tel" && performance.now() - p.lastIn > 2500) {
        ctx.fillStyle = "#fca5a5"; ctx.textAlign = "right"; ctx.font = "700 " + Math.round(12 * u) + "px Outfit, sans-serif";
        ctx.fillText("ni povezan", x + cw - 10 * u, y0 + 10 * u);
      }
    });

    if (G.phase === "count") {
      var c = Math.ceil(G.count - 0.2);
      var txt = c > 0 ? String(c) : "PRDI!";
      var k2 = G.count % 1;
      ctx.font = "900 " + Math.round((120 + 40 * k2) * u) + "px Outfit, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillText(txt, W / 2 + 4, H * 0.42 + 6);
      ctx.fillStyle = "#d9f99d"; ctx.fillText(txt, W / 2, H * 0.42);
    }
  }

  function fit(s, w) {
    if (ctx.measureText(s).width <= w) return s;
    while (s.length > 1 && ctx.measureText(s + "…").width > w) s = s.slice(0, -1);
    return s + "…";
  }

  /* =================== Zanka =================== */
  var last = performance.now();
  function loop(now) {
    // simulacija v korakih po največ 1/60 s — tudi ob padcu sličic teče v pravem času
    var total = Math.min(0.25, (now - last) / 1000);
    var frameDt = total;
    last = now;
    while (total > 0) {
      var dt = Math.min(1 / 60, total);
      total -= dt;
      step(dt);
    }
    if (R3 && view === "3d") draw3d(frameDt); else draw();
    updateMiniJoin();
    if (now - lastPush > 200) pushState(false);
    requestAnimationFrame(loop);
  }

  function step(dt) {
    G.time += dt;
    updateGates(dt);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt);
    if (G.inv > 0) G.inv = Math.max(0, G.inv - dt);

    if (G.phase === "count") {
      G.count -= dt;
      updatePlayers(dt, false);
      if (G.count <= 0) { G.phase = "play"; sound.fart(0.6); pushState(true); }
    } else if (G.phase === "play") {
      G.t += dt;
      updatePlayers(dt, true);
      physics(dt);
    } else if (G.phase === "menu" || G.phase === "lobby") {
      // splav na začetku lenobno pluje
      G.raft.y = 140 + Math.sin(G.time * 0.5) * 20;
      G.raft.ang = Math.sin(G.time * 0.3) * 0.4;
    } else {
      physics(dt);
    }
    updateParts(dt);

    var r = G.raft, lv = LEVELS[G.lv];
    var tx = r.x * 0.7 + river(lv, r.y).cx * 0.3, ty = r.y + 40;
    var ck = 1 - Math.exp(-3 * dt);
    G.cam.x += (tx - G.cam.x) * ck; G.cam.y += (ty - G.cam.y) * ck;
  }

  /* =================== Telefoni (soba) =================== */
  var sb = NET.client();
  var me = null; // prijavljeni uporabnik gostitelja
  var lastPush = 0;

  var tel = {
    room: null, code: null, ready: false,
    players: [],   // { uid, name, slot, waiting }

    open: function () {
      if (!sb || !me) return;
      tel.close();
      tel.code = NET.newCode();
      tel.players = [];
      tel.ready = false;
      var room = NET.channel(sb, tel.code, "host");
      tel.room = room;
      room
        .on("presence", { event: "sync" }, tel.onPresence)
        .on("broadcast", { event: NET.EV.IN }, function (m) { tel.onInput(m.payload || {}); })
        .on("broadcast", { event: NET.EV.CMD }, function (m) { tel.onCmd(m.payload || {}); })
        .subscribe(function (status) {
          if (status === "SUBSCRIBED") {
            tel.ready = true;
            room.track({ host: true, at: Date.now() });
            $("lobbyMsg").textContent = "Soba je odprta. Čakam na igralce …";
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            $("lobbyMsg").textContent = "Povezave s strežnikom ni. Preveri internet in odpri sobo znova.";
          }
        });
      $("roomCode").textContent = tel.code;
      $("miniCode").textContent = tel.code;
      $("roomUrl").textContent = "";
      $("qr").innerHTML = ""; $("qrMini").innerHTML = "";
      var code = tel.code;
      NET.joinBase().then(function (base) {
        if (tel.code !== code) return; // medtem odprta druga soba
        var url = NET.controllerUrl(code, base);
        $("roomUrl").textContent = url.replace(/^https?:\/\//, "");
        drawQr($("qr"), url, 320);
        drawQr($("qrMini"), url, 132);
      });
      tel.render();
    },

    close: function () {
      if (tel.room) { try { sb.removeChannel(tel.room); } catch (e) {} }
      tel.room = null; tel.ready = false; tel.players = [];
    },

    freeSlot: function () {
      for (var s = 0; s < 4; s++) {
        if (!tel.players.some(function (p) { return !p.waiting && p.slot === s; })) return s;
      }
      return -1;
    },

    onPresence: function () {
      if (!tel.room) return;
      var state = tel.room.presenceState();
      var online = {};
      Object.keys(state).forEach(function (k) {
        if (k === "host") return;
        var meta = (state[k] && state[k][0]) || {};
        online[k] = meta.name || "Igralec";
      });
      var canChange = G.phase === "lobby" || G.phase === "end" || G.phase === "over" || G.phase === "menu";
      // odšli
      tel.players = tel.players.filter(function (p) { return online[p.uid] || !(canChange || p.waiting); });
      // novi
      Object.keys(online).forEach(function (uid) {
        var p = tel.players.find(function (x) { return x.uid === uid; });
        if (p) { p.name = online[uid]; return; }
        var slot = tel.freeSlot();
        if (slot >= 0 && canChange) tel.players.push({ uid: uid, name: online[uid], slot: slot, waiting: false });
        else tel.players.push({ uid: uid, name: online[uid], slot: -1, waiting: true });
      });
      tel.render();
      pushState(true);
    },

    admitWaiting: function () {
      tel.onPresence(); // odstrani tiste, ki so med vožnjo odšli
      tel.players.forEach(function (p) {
        if (!p.waiting) return;
        var s = tel.freeSlot();
        if (s >= 0) { p.slot = s; p.waiting = false; }
      });
      tel.render();
    },

    onInput: function (m) {
      var p = G.players.find(function (x) { return x.uid === m.u; });
      if (!p) return;
      p.inp.l = !!m.l; p.inp.r = !!m.r; p.inp.f = !!m.f;
      p.lastIn = performance.now();
    },

    onCmd: function (m) {
      if (!tel.players.some(function (p) { return p.uid === m.u; })) return;
      if (m.a === "start" && G.phase === "lobby") beginTel();
      else if (m.a === "next" && G.phase === "end") next();
      else if (m.a === "retry" && (G.phase === "end" || G.phase === "over")) startLevel(G.lv);
    },

    render: function () {
      var ul = $("roster");
      ul.innerHTML = "";
      var active = tel.players.filter(function (p) { return !p.waiting; }).sort(function (a, b) { return a.slot - b.slot; });
      for (var s = 0; s < 4; s++) {
        var p = active.find(function (x) { return x.slot === s; });
        var li = document.createElement("li");
        var dot = document.createElement("i");
        dot.style.background = ANIMALS[s].ring;
        li.appendChild(dot);
        if (p) {
          li.appendChild(document.createTextNode(p.name));
          var sp = document.createElement("span"); sp.textContent = ANIMALS[s].name;
          li.appendChild(sp);
        } else {
          li.className = "empty";
          li.appendChild(document.createTextNode(ANIMALS[s].name + " · prosto"));
        }
        ul.appendChild(li);
      }
      var waiting = tel.players.filter(function (p) { return p.waiting; }).length;
      if (waiting && tel.ready) $("lobbyMsg").textContent = waiting + " čaka na prosto mesto.";
      $("btnStart").disabled = !active.length;
    }
  };

  function drawQr(el, url, size) {
    el.innerHTML = "";
    el.hidden = false;
    if (!window.QRCode) { el.hidden = true; return; }
    try { new window.QRCode(el, { text: url, width: size, height: size, correctLevel: window.QRCode.CorrectLevel.M }); }
    catch (e) { el.hidden = true; }
  }

  // mala QR koda v kotu med vožnjo — da se lahko pridruži še kdo (vstopi na naslednji progi)
  function updateMiniJoin() {
    var show = G.mode === "tel" && !!tel.room && G.phase !== "lobby" && G.phase !== "menu";
    var el = $("miniJoin");
    if (el.hidden === show) el.hidden = !show;
  }

  function beginTel() {
    if (!tel.players.some(function (p) { return !p.waiting; })) return;
    startLevel(G.lv);
  }

  function pushState(force) {
    if (!tel.room || !tel.ready) return;
    var now = performance.now();
    if (!force && now - lastPush < 200) return;
    lastPush = now;
    var byUid = {};
    G.players.forEach(function (p) { if (p.uid) byUid[p.uid] = p; });
    var lv = LEVELS[G.lv];
    tel.room.send({
      type: "broadcast", event: NET.EV.ST,
      payload: {
        ph: G.phase, lv: G.lv, lvName: lv.name, lives: G.lives, maxLives: MAXL,
        next: G.phase === "end" && G.lv < LEVELS.length - 1,
        p: tel.players.map(function (t) {
          var gp = byUid[t.uid];
          return { u: t.uid, s: t.slot, w: !!t.waiting, g: gp ? Math.round(gp.gas * 100) / 100 : 1, c: gp ? Math.round(gp.charge * 100) / 100 : 0 };
        })
      }
    });
  }

  function sendBuzz(p) {
    if (p.uid && tel.room && tel.ready) pushState(true);
  }

  /* =================== Meni in gumbi =================== */
  function showOnly(id) {
    ["menu", "lobby", "end"].forEach(function (k) { $(k).hidden = k !== id; });
  }

  function renderKeys() {
    var box = $("keysList");
    box.innerHTML = "";
    for (var i = 0; i < G.n; i++) {
      var d = document.createElement("div");
      var dot = document.createElement("i"); dot.style.background = ANIMALS[i].ring;
      d.appendChild(dot);
      d.appendChild(document.createTextNode("P" + (i + 1) + " " + ANIMALS[i].name + ": "));
      KEYS[i].label.forEach(function (l, j) {
        var k = document.createElement("kbd"); k.textContent = l; d.appendChild(k);
        if (j < 2) d.appendChild(document.createTextNode(" "));
      });
      d.appendChild(document.createTextNode(" (levo · desno · prdec)"));
      box.appendChild(d);
    }
  }

  function renderLevels() {
    var box = $("lvPick");
    box.innerHTML = "";
    LEVELS.forEach(function (lv, i) {
      var b = document.createElement("button");
      b.type = "button";
      if (i === G.lv) b.className = "on";
      b.appendChild(document.createTextNode(lv.name));
      var sm = document.createElement("small");
      sm.textContent = G.best[lv.name] ? "rekord " + fmt(G.best[lv.name]) : "še brez rekorda";
      b.appendChild(sm);
      b.addEventListener("click", function () { G.lv = i; resetRaft(LEVELS[i]); renderLevels(); });
      box.appendChild(b);
    });
  }

  function toMenu() {
    if (G.mode === "tel" && tel.room) { toLobby(); return; }
    G.phase = "menu";
    G.players = makePlayers([{ slot: 0 }, { slot: 1 }, { slot: 2 }, { slot: 3 }].slice(0, G.n));
    resetRaft(LEVELS[G.lv]);
    $("btnPause").hidden = true;
    renderLevels();
    showOnly("menu");
  }

  function toLobby() {
    G.phase = "lobby";
    G.players = makePlayers(tel.players.filter(function (p) { return !p.waiting; }));
    resetRaft(LEVELS[G.lv]);
    $("btnPause").hidden = true;
    tel.admitWaiting();
    showOnly("lobby");
    pushState(true);
  }

  function next() {
    if (G.lv < LEVELS.length - 1) startLevel(G.lv + 1);
    else startLevel(G.lv);
  }

  $("nPick").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    G.n = Number(b.getAttribute("data-n"));
    Array.prototype.forEach.call(this.children, function (c) { c.classList.toggle("on", c === b); });
    renderKeys();
    G.players = makePlayers([{ slot: 0 }, { slot: 1 }, { slot: 2 }, { slot: 3 }].slice(0, G.n));
  });
  $("btnKb").addEventListener("click", function () { G.mode = "kb"; tel.close(); startLevel(G.lv); });
  $("btnTel").addEventListener("click", function () {
    if (!me) return;
    G.mode = "tel";
    sound.unlock();
    tel.open();
    toLobby();
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () {});
    }
  });
  $("btnStart").addEventListener("click", beginTel);
  $("btnLobbyBack").addEventListener("click", function () { tel.close(); G.mode = "kb"; toMenu(); });
  $("btnNext").addEventListener("click", next);
  $("btnRetry").addEventListener("click", function () { startLevel(G.lv); });
  $("btnMenu").addEventListener("click", function () { if (G.mode === "tel") toLobby(); else toMenu(); });
  $("btnPause").addEventListener("click", toMenu);
  $("btnFs").addEventListener("click", function () {
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  });

  var GAME_KEYS = {};
  KEYS.forEach(function (k) { k.l.concat(k.r, k.f).forEach(function (c) { GAME_KEYS[c] = true; }); });
  window.addEventListener("keydown", function (e) {
    if (GAME_KEYS[e.code] && (G.phase === "play" || G.phase === "count")) e.preventDefault();
    keysDown[e.code] = true;
    sound.unlock();
    if (e.code === "Escape" && (G.phase === "play" || G.phase === "count")) toMenu();
    if ((e.code === "Enter" || e.code === "NumpadEnter") && (G.phase === "end" || G.phase === "over")) {
      if (G.phase === "end" && G.lv < LEVELS.length - 1) next(); else startLevel(G.lv);
    }
    if (e.code === "KeyR" && (G.phase === "play" || G.phase === "over" || G.phase === "end")) startLevel(G.lv);
  });
  window.addEventListener("keyup", function (e) { keysDown[e.code] = false; });
  window.addEventListener("blur", function () { keysDown = {}; });

  // kurzor se skrije med igro, ko miruje
  var cursorT = null;
  window.addEventListener("mousemove", function () {
    document.body.classList.remove("hide-cursor");
    clearTimeout(cursorT);
    cursorT = setTimeout(function () {
      if (G.phase === "play" || G.phase === "count") document.body.classList.add("hide-cursor");
    }, 2000);
  });

  // telefon → ponudi kontroler
  if (window.matchMedia && matchMedia("(pointer: coarse)").matches && !matchMedia("(any-pointer: fine)").matches &&
      Math.min(screen.width, screen.height) < 600) {
    $("phoneHint").hidden = false;
  }

  /* =================== Zagon =================== */
  $("viewPick").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (b) setView(b.getAttribute("data-v"));
  });
  var savedView = "3d";
  try { savedView = localStorage.getItem("prdoplav-view") || "3d"; } catch (e) {}
  setView(savedView);

  renderKeys();
  renderLevels();
  G.players = makePlayers([{ slot: 0 }, { slot: 1 }]);
  resetRaft(LEVELS[0]);
  requestAnimationFrame(loop);

  var telBtn = $("btnTel"), telNote = $("telNote");
  telBtn.disabled = true;
  if (!sb) {
    telNote.hidden = false; telNote.textContent = "Povezava s TomsStudiom ni na voljo.";
  } else {
    sb.auth.getSession().then(function (res) {
      var s = res && res.data && res.data.session;
      if (!s) {
        telNote.hidden = false;
        telNote.textContent = "Za sobo s telefoni se najprej prijavi na plošči TomsStudia.";
        return;
      }
      me = s.user;
      telBtn.disabled = false;
    }, function () {
      telNote.hidden = false; telNote.textContent = "Ni povezave.";
    });
  }
})();

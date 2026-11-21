/* Prdoplav — 3D izris (Three.js r149, globalni THREE). Fizika ostane v prdoplav.js;
   tukaj samo prikaz stanja, ki ga da window.PRDOPLAV.
   Pretvorba: svet (x, y naprej) → three (x, višina, -y). */
(function () {
  "use strict";

  function create(canvas, api) {
    var T = window.THREE;
    var renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
    } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    var SKY = 0x9fd8f5;
    var scene = new T.Scene();
    scene.background = new T.Color(SKY);
    scene.fog = new T.Fog(SKY, 1400, 3200);

    var camera = new T.PerspectiveCamera(50, 1, 5, 7000);
    var hemi = new T.HemisphereLight(0xeaf6ff, 0x3f6b2a, 0.75);
    scene.add(hemi);
    var sun = new T.DirectionalLight(0xfff3d6, 0.85);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    var sc = sun.shadow.camera;
    sc.left = -600; sc.right = 600; sc.top = 600; sc.bottom = -600; sc.near = 10; sc.far = 2400;
    sun.shadow.bias = -0.0015;
    scene.add(sun); scene.add(sun.target);

    var A = api.ANIMALS, RAFT = api.RAFT;
    var t = 0;
    var levelIdx = -1, levelWk = -1, levelGroup = null, water = null, waterBase = null, logs = [], pools = [], flows = [], gates = [], spinners = [], crocs3 = [], mozje3 = [], buoys3 = [];
    var curLv = null, eTab = null, E_STEP = 10, E_Y0 = -600;
    // Višina v 3D. Strme dele klancev prikažemo položneje (največ naklon VIS_SLOPE),
    // sicer je razdalja po klancu na videz precej daljša od tiste, ki jo računa fizika
    // (trk s skalo bi se zgodil, ko je skala na videz še daleč). Blagi hribčki ostanejo enaki.
    var VIS_SLOPE = 0.35;
    function visSlope(lv, y) { return Math.max(-VIS_SLOPE, Math.min(VIS_SLOPE, api.slopeAt(lv, y))); }
    var FALL_LEN = 40;
    function fallDrop(lv, y) {
      var d = 0;
      (lv.Fa || []).forEach(function (f) { d += f.drop * Math.max(0, Math.min(1, (y - f.y) / FALL_LEN)); });
      return d;
    }
    function buildElev(lv) {
      eTab = [];
      var h = api.elev(lv, E_Y0);
      for (var y = E_Y0; y <= lv.len + 1400; y += E_STEP) {
        eTab.push(h);
        h += visSlope(lv, y + E_STEP / 2) * E_STEP - (fallDrop(lv, y + E_STEP) - fallDrop(lv, y));
      }
    }
    function E(y) {
      if (!curLv || !eTab) return 0;
      var f = (y - E_Y0) / E_STEP, i = Math.floor(f);
      if (i < 0) return eTab[0];
      if (i >= eTab.length - 1) return eTab[eTab.length - 1];
      return eTab[i] + (eTab[i + 1] - eTab[i]) * (f - i);
    }

    function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
    function wave(x, z) {
      return 2.2 * Math.sin(x * 0.018 + t * 1.3) + 1.8 * Math.sin(z * 0.022 + t * 1.9) + 1.2 * Math.sin((x + z) * 0.03 - t * 2.4);
    }
    function mat(c, o) {
      var m = new T.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85, metalness: 0 });
      if (o) Object.keys(o).forEach(function (k) { m[k] = o[k]; });
      return m;
    }
    function mesh(geo, m, shadow) {
      var x = new T.Mesh(geo, m);
      if (shadow !== false) { x.castShadow = true; x.receiveShadow = true; }
      return x;
    }

    /* ---------- proga ---------- */
    var COLS = [
      [-1600, 34, 0x4d8f3a], [-500, 30, 0x4d8f3a], [-50, 26, 0x5a9b40], [-14, 6, 0xe7cf96],
      [30, -24, 0xb59a62], [null, -30, 0x7d6a45], [-30, -24, 0xb59a62], [14, 6, 0xe7cf96],
      [50, 26, 0x5a9b40], [500, 30, 0x4d8f3a], [1600, 34, 0x4d8f3a]
    ];
    // brez ograje: kamnit rob ob vodi, nato prepad v sotesko
    var CLIFF = [
      [-1600, -470, 0x3b2f2a], [-500, -460, 0x4a3b32], [-50, -400, 0x6b5a4e], [-14, -4, 0x94a3b8],
      [30, -24, 0xb59a62], [null, -30, 0x7d6a45], [-30, -24, 0xb59a62], [14, -4, 0x94a3b8],
      [50, -400, 0x6b5a4e], [500, -460, 0x4a3b32], [1600, -470, 0x3b2f2a]
    ];
    function colX(rv, i) {
      var c = COLS[i][0];
      if (c === null) return rv.cx;
      return i < 5 ? rv.cx - rv.hw + c : rv.cx + rv.hw + c;
    }

    function buildLevel(i) {
      if (levelGroup) {
        scene.remove(levelGroup);
        levelGroup.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); });
        });
      }
      levelIdx = i;
      var lv = api.LEVELS[i];
      levelWk = lv.wk;
      curLv = lv;
      buildElev(lv);
      var prof = lv.noFence ? CLIFF : COLS, floor = lv.noFence ? -490 : 0; // drevesa na dnu soteske
      levelGroup = new T.Group();
      scene.add(levelGroup);
      logs = []; pools = []; flows = []; gates = []; spinners = []; crocs3 = []; mozje3 = []; buoys3 = [];

      // teren (trava, pesek, dno)
      var y0 = -700, y1 = lv.len + 1400, step = 40;
      var rows = Math.ceil((y1 - y0) / step) + 1, nc = COLS.length;
      var pos = [], col = [], idx = [], c = new T.Color();
      for (var r = 0; r < rows; r++) {
        var y = y0 + r * step, rv = api.river(lv, y);
        for (var k = 0; k < nc; k++) {
          // odsek brez ograje na tej strani → prepad (CLIFF), sicer trava
          var pk = (k < 5 && api.openSide(lv, y, "L")) || (k > 5 && api.openSide(lv, y, "R")) ? CLIFF : prof;
          var h = pk[k][1];
          if (k <= 2 || k >= nc - 3) h += hash(y * 0.31 + k * 7.7) * 10 - 3;
          pos.push(colX(rv, k), h + E(y), -y);
          c.setHex(pk[k][2]);
          var j = 0.94 + hash(y * 0.7 + k) * 0.1;
          col.push(c.r * j, c.g * j, c.b * j);
        }
      }
      for (r = 0; r < rows - 1; r++) for (k = 0; k < nc - 1; k++) {
        var a = r * nc + k, b = a + 1, d = a + nc, e = d + 1;
        idx.push(a, b, d, b, e, d);
      }
      var tg = new T.BufferGeometry();
      tg.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      tg.setAttribute("color", new T.Float32BufferAttribute(col, 3));
      tg.setIndex(idx);
      tg = tg.toNonIndexed();
      tg.computeVertexNormals();
      var terrain = new T.Mesh(tg, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
      terrain.receiveShadow = true;
      levelGroup.add(terrain);

      // voda
      var wc = 12, wstep = 30, wrows = Math.ceil((y1 - y0) / wstep) + 1;
      var wp = [], wi = [];
      for (r = 0; r < wrows; r++) {
        var wy = y0 + r * wstep, wrv = api.river(lv, wy);
        for (k = 0; k < wc; k++) {
          var wx = wrv.cx - wrv.hw - 20 + (wrv.hw * 2 + 40) * k / (wc - 1);
          wp.push(wx, 0, -wy);
        }
      }
      for (r = 0; r < wrows - 1; r++) for (k = 0; k < wc - 1; k++) {
        var p = r * wc + k;
        wi.push(p, p + 1, p + wc, p + 1, p + wc + 1, p + wc);
      }
      var wg = new T.BufferGeometry();
      wg.setAttribute("position", new T.Float32BufferAttribute(wp, 3));
      wg.setIndex(wi);
      wg = wg.toNonIndexed();
      // osnovna višina vsake točke vode (hribčki); valovi se prištejejo ob izrisu
      var wa = wg.attributes.position.array, base = new Float32Array(wa.length / 3);
      for (var bi = 0; bi < base.length; bi++) { base[bi] = E(-wa[bi * 3 + 2]); wa[bi * 3 + 1] = base[bi]; }
      waterBase = base;
      water = new T.Mesh(wg, new T.MeshStandardMaterial({
        color: 0x2f8fd8, flatShading: true, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.88
      }));
      water.receiveShadow = true;
      levelGroup.add(water);

      // drevesa in grmi
      var spots = [];
      for (var ty = y0; ty < y1; ty += 75) {
        var trv = api.river(lv, ty);
        for (var side = -1; side <= 1; side += 2) for (var q = 0; q < 3; q++) {
          var hq = hash(ty * 0.13 + side * 7 + q * 31);
          spots.push({ x: trv.cx + side * (trv.hw + 90 + hq * 380 + q * 160), y: ty + hash(ty + q) * 60, s: 0.7 + hash(ty * 3 + q + side) * 0.7, bush: q === 1, fl: api.openSide(lv, ty, side < 0 ? "L" : "R") ? -490 : 0 });
        }
      }
      var trees = spots.filter(function (s) { return !s.bush; }), bushes = spots.filter(function (s) { return s.bush; });
      var crowns = new T.InstancedMesh(new T.ConeGeometry(42, 100, 6), mat(0x2f6f2d), trees.length);
      var trunks = new T.InstancedMesh(new T.CylinderGeometry(6, 9, 34, 5), mat(0x7c4a1e), trees.length);
      var bushM = new T.InstancedMesh(new T.IcosahedronGeometry(30, 0), mat(0x3f7f35), bushes.length);
      var m4 = new T.Matrix4(), q4 = new T.Quaternion(), s3 = new T.Vector3(), v3 = new T.Vector3();
      trees.forEach(function (s, n) {
        s3.set(s.s, s.s, s.s);
        var e = E(s.y) + s.fl;
        m4.compose(v3.set(s.x, e + 30 + 17 * s.s, -s.y), q4, s3); trunks.setMatrixAt(n, m4);
        m4.compose(v3.set(s.x, e + 30 + 34 * s.s + 50 * s.s, -s.y), q4, s3); crowns.setMatrixAt(n, m4);
      });
      var upAxis = new T.Vector3(0, 1, 0), bq = new T.Quaternion();
      bushes.forEach(function (s, n) {
        s3.set(s.s, s.s * 0.7, s.s);
        bq.setFromAxisAngle(upAxis, s.y);
        m4.compose(v3.set(s.x, 32 + s.fl + E(s.y), -s.y), bq, s3);
        bushM.setMatrixAt(n, m4);
      });
      [crowns, trunks, bushM].forEach(function (im) { im.castShadow = true; im.receiveShadow = true; levelGroup.add(im); });

      // skale
      lv.R.forEach(function (o, n) {
        var rock = mesh(new T.IcosahedronGeometry(o.r * 1.05, 0), mat(0x7b8491));
        rock.position.set(o.x, 2 + E(o.y), -o.y);
        rock.scale.set(1, 0.75, 1);
        rock.rotation.set(hash(n) * 3, hash(n + 9) * 6, hash(n + 3) * 3);
        levelGroup.add(rock);
        var foam = new T.Mesh(new T.RingGeometry(o.r * 1.0, o.r * 1.25, 18), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
        foam.rotation.x = -Math.PI / 2; foam.position.set(o.x, 3 + E(o.y), -o.y);
        levelGroup.add(foam);
      });

      // vrtiljaki: steber iz vode + vrteči se leseni križ z rdečimi konci
      lv.Sp.forEach(function (sp) {
        var base = E(sp.y);
        var post = mesh(new T.CylinderGeometry(api.SPIN_HUB, api.SPIN_HUB * 1.2, 60, 10), mat(0x5b3a1f));
        post.position.set(sp.x, base + 10, -sp.y);
        levelGroup.add(post);
        var rot = new T.Group();
        rot.position.set(sp.x, base + 22, -sp.y);
        for (var k = 0; k < sp.angs.length; k++) {
          var arm = new T.Group();
          var plank = mesh(new T.BoxGeometry(sp.len, 14, api.SPIN_ARM * 2), mat(0x92562a));
          plank.position.x = sp.len / 2;
          arm.add(plank);
          var tip = mesh(new T.BoxGeometry(10, 18, api.SPIN_ARM * 2 + 4), mat(0xdc2626));
          tip.position.x = sp.len - 5;
          arm.add(tip);
          arm.rotation.y = sp.angs[k];
          rot.add(arm);
        }
        var cap = mesh(new T.CylinderGeometry(api.SPIN_HUB * 0.7, api.SPIN_HUB, 14, 10), mat(0xa16207));
        cap.position.y = 12;
        rot.add(cap);
        levelGroup.add(rot);
        spinners.push({ s: sp, g: rot });
      });

      // hlodi
      lv.L.forEach(function (l) {
        var g = new T.Group();
        var body = mesh(new T.CylinderGeometry(10, 10, l.half * 2, 10), mat(0x7c4a1e));
        body.rotation.z = Math.PI / 2;
        g.add(body);
        [-1, 1].forEach(function (s) {
          var cap = mesh(new T.CircleGeometry(9, 10), mat(0xc08a52));
          cap.position.x = s * (l.half + 0.5); cap.rotation.y = s * Math.PI / 2;
          g.add(cap);
        });
        g.position.set(l.bx, 4, -l.y);
        levelGroup.add(g);
        logs.push({ l: l, g: g });
      });

      // krokodili: telo, glava z gobcem, oči, rep (gleda v smer +x, obrnemo po smeri plavanja)
      lv.Cr.forEach(function (c) {
        var g = new T.Group(), H = api.CROC_HALF, R = api.CROC_R, green = 0x3f6212;
        var body = mesh(new T.BoxGeometry(H * 1.5, R * 0.9, R * 2), mat(green));
        body.position.x = -H * 0.1; g.add(body);
        for (var sc = -2; sc <= 2; sc++) {
          var bump = mesh(new T.BoxGeometry(8, 6, 8), mat(0x365314));
          bump.position.set(sc * 12 - 6, R * 0.5, 0); g.add(bump);
        }
        var head = new T.Group(); head.position.x = H * 0.65; g.add(head);
        var upper = mesh(new T.BoxGeometry(H * 0.75, R * 0.45, R * 1.4), mat(0x4d7c0f));
        upper.position.set(H * 0.35, R * 0.15, 0); head.add(upper);
        var jaw = new T.Group(); head.add(jaw);
        var lower = mesh(new T.BoxGeometry(H * 0.75, R * 0.3, R * 1.3), mat(0x4d7c0f));
        lower.position.set(H * 0.35, -R * 0.2, 0); jaw.add(lower);
        [-1, 1].forEach(function (s) {
          var eye = mesh(new T.SphereGeometry(4, 8, 6), mat(0xfef9c3)); eye.position.set(-2, R * 0.55, s * R * 0.45); head.add(eye);
          var pupil = mesh(new T.SphereGeometry(2, 6, 4), mat(0x111111)); pupil.position.set(0, R * 0.6, s * R * 0.5); head.add(pupil);
        });
        var tail = mesh(new T.ConeGeometry(R * 0.7, H * 0.9, 4), mat(green));
        tail.rotation.z = Math.PI / 2; tail.position.x = -H * 1.2; g.add(tail);
        levelGroup.add(g);
        crocs3.push({ c: c, g: g, jaw: jaw, rot: 0 });
      });

      // povodni možje: temen vrtinec, zelena glava z lasmi iz trstičja, roke se dvignejo
      lv.Pm.forEach(function (pm) {
        var g = new T.Group();
        var disc = new T.Mesh(new T.CircleGeometry(api.PM_GRAB + 30, 28), new T.MeshBasicMaterial({ color: 0x052e16, transparent: true, opacity: 0.6 }));
        disc.rotation.x = -Math.PI / 2; disc.position.y = 3; g.add(disc);
        var swirl = new T.Group(); swirl.position.y = 4; g.add(swirl);
        for (var k3 = 0; k3 < 3; k3++) {
          var arc = new T.Mesh(new T.TorusGeometry((api.PM_GRAB + 30) * (0.4 + k3 * 0.2), 2, 4, 20, 1.8),
            new T.MeshBasicMaterial({ color: 0xbbf7d0, transparent: true, opacity: 0.45 }));
          arc.rotation.x = -Math.PI / 2; arc.rotation.z = k3 * 2.1; swirl.add(arc);
        }
        var body = new T.Group(); g.add(body);
        var head = mesh(new T.SphereGeometry(18, 12, 10), mat(0x65a30d)); head.position.y = 10; body.add(head);
        for (var h3 = -2; h3 <= 2; h3++) {
          var reed = mesh(new T.ConeGeometry(3, 26, 4), mat(0x365314));
          reed.position.set(h3 * 6, 30, -4); reed.rotation.z = h3 * 0.25; body.add(reed);
        }
        [-1, 1].forEach(function (s) {
          var eye = mesh(new T.SphereGeometry(4.5, 8, 6), mat(0xfef9c3)); eye.position.set(s * 7, 16, 14); body.add(eye);
          var pupil = mesh(new T.SphereGeometry(2.2, 6, 4), mat(0x111111)); pupil.position.set(s * 7, 16, 18); body.add(pupil);
        });
        var arms = [];
        [-1, 1].forEach(function (s) {
          var arm = new T.Group(); arm.position.set(s * 16, 4, 0);
          var limb = mesh(new T.CylinderGeometry(3.5, 4, 34, 6), mat(0x4d7c0f)); limb.position.y = 17; arm.add(limb);
          var hand = mesh(new T.SphereGeometry(6, 8, 6), mat(0x65a30d)); hand.position.y = 36; arm.add(hand);
          arm.rotation.z = -s * 0.5;
          body.add(arm); arms.push({ g: arm, s: s });
        });
        // obraz proti sredini reke (svet: +x desno; glava gleda v +z, po rotaciji proti reki)
        body.rotation.y = pm.side > 0 ? -Math.PI / 2 : Math.PI / 2;
        g.position.set(pm.x, 0, -pm.y);
        levelGroup.add(g);
        mozje3.push({ pm: pm, g: g, body: body, swirl: swirl, arms: arms, near: 0 });
      });

      // rešilni obroči (rdeče-beli)
      lv.Bu.forEach(function (b) {
        var g = new T.Group();
        for (var q = 0; q < 8; q++) {
          var seg = mesh(new T.TorusGeometry(api.BUOY_R, 5, 6, 6, Math.PI / 4), mat(q % 2 ? 0xf8fafc : 0xdc2626));
          seg.rotation.x = -Math.PI / 2; seg.rotation.z = q * Math.PI / 4; g.add(seg);
        }
        g.position.set(b.x, 0, -b.y);
        levelGroup.add(g);
        buoys3.push({ b: b, g: g });
      });

      // slapovi: pena spodaj, temen rob zgoraj, zelena kola ob žlebu
      lv.Fa.forEach(function (f) {
        var foam = new T.Mesh(new T.PlaneGeometry(f.rhw * 2 + 40, 90), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
        foam.rotation.x = -Math.PI / 2; foam.position.set(f.rcx, E(f.y + FALL_LEN + 45) + 5, -(f.y + FALL_LEN + 45));
        levelGroup.add(foam);
        var lip = new T.Mesh(new T.PlaneGeometry(f.rhw * 2 + 40, 14), new T.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.8 }));
        lip.rotation.x = -Math.PI / 2; lip.position.set(f.rcx, E(f.y) + 4, -f.y);
        levelGroup.add(lip);
        var chute = new T.Mesh(new T.PlaneGeometry(f.hw * 2, 60), new T.MeshBasicMaterial({ color: 0x86efac, transparent: true, opacity: 0.35 }));
        chute.rotation.x = -Math.PI / 2; chute.position.set(f.cx, E(f.y - 30) + 4, -(f.y - 30));
        levelGroup.add(chute);
        [-1, 1].forEach(function (s) {
          var pole = mesh(new T.CylinderGeometry(5, 6, 70, 8), mat(0x166534));
          pole.position.set(f.cx + s * f.hw, E(f.y) + 30, -(f.y - 6));
          levelGroup.add(pole);
          var flag = mesh(new T.ConeGeometry(12, 30, 3), mat(0x4ade80));
          flag.rotation.z = -Math.PI / 2; flag.position.set(f.cx + s * f.hw + 15, E(f.y) + 58, -(f.y - 6));
          levelGroup.add(flag);
        });
      });

      // vrtinci
      lv.P.forEach(function (p) {
        var g = new T.Group();
        var disc = new T.Mesh(new T.CircleGeometry(p.r, 32), new T.MeshBasicMaterial({ color: 0x0b3a5c, transparent: true, opacity: 0.45 }));
        disc.rotation.x = -Math.PI / 2;
        g.add(disc);
        for (var k2 = 0; k2 < 4; k2++) {
          var arc = new T.Mesh(new T.TorusGeometry(p.r * (0.3 + k2 * 0.17), 2.5, 4, 20, 2.2),
            new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
          arc.rotation.x = -Math.PI / 2; arc.rotation.z = k2 * Math.PI / 2;
          g.add(arc);
        }
        g.position.set(p.x, 3 + E(p.y), -p.y);
        levelGroup.add(g);
        pools.push({ p: p, g: g });
      });

      // tokovi — puščice na vodi
      var chev = new T.Shape();
      chev.moveTo(-8, -12); chev.lineTo(8, 0); chev.lineTo(-8, 12); chev.lineTo(-3, 0); chev.closePath();
      var chevGeo = new T.ShapeGeometry(chev);
      var chevMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: T.DoubleSide });
      lv.F.forEach(function (f) {
        var a = Math.atan2(f.fy + api.CURRENT, f.fx);
        for (var yy = f.y + 30; yy < f.y + f.h - 20; yy += 60) {
          var rv2 = api.river(lv, yy);
          for (var xx = -1; xx <= 1; xx++) {
            var m = new T.Mesh(chevGeo, chevMat);
            m.rotation.x = -Math.PI / 2; m.rotation.z = a;
            m.scale.set(1.4, 1.4, 1.4);
            levelGroup.add(m);
            flows.push({ m: m, x: rv2.cx + xx * rv2.hw * 0.55, y: yy, a: a });
          }
        }
      });

      // start (pomol) in cilj
      var rs = api.river(lv, 40);
      var dock = mesh(new T.BoxGeometry(rs.hw * 2 + 80, 8, 40), mat(0xa16207));
      dock.position.set(rs.cx, 8 + E(40), -40);
      levelGroup.add(dock);

      var rf = api.river(lv, lv.len);
      var cv = document.createElement("canvas");
      cv.width = 512; cv.height = 128;
      var cx2 = cv.getContext("2d");
      for (var i2 = 0; i2 < 16; i2++) for (var j2 = 0; j2 < 4; j2++) {
        cx2.fillStyle = (i2 + j2) % 2 ? "#111827" : "#f8fafc";
        cx2.fillRect(i2 * 32, j2 * 32, 32, 32);
      }
      cx2.fillStyle = "rgba(0,0,0,0.55)"; cx2.fillRect(150, 22, 212, 84);
      cx2.fillStyle = "#fde047"; cx2.font = "900 72px Outfit, sans-serif"; cx2.textAlign = "center"; cx2.textBaseline = "middle";
      cx2.fillText("CILJ", 256, 66);
      var tex = new T.CanvasTexture(cv);
      var bw = rf.hw * 2 + 60, ef = E(lv.len);
      var banner = mesh(new T.BoxGeometry(bw, 70, 6), [mat(0x111827), mat(0x111827), mat(0x111827), mat(0x111827),
        new T.MeshStandardMaterial({ map: tex, roughness: 1 }), new T.MeshStandardMaterial({ map: tex, roughness: 1 })]);
      banner.position.set(rf.cx, 150 + ef, -lv.len);
      levelGroup.add(banner);
      [-1, 1].forEach(function (s) {
        var pole = mesh(new T.CylinderGeometry(6, 6, 190, 8), mat(0x78350f));
        pole.position.set(rf.cx + s * (bw / 2), 95 + ef, -lv.len);
        levelGroup.add(pole);
        var flag = mesh(new T.ConeGeometry(16, 40, 3), mat(s < 0 ? 0xfacc15 : 0xef4444));
        flag.rotation.z = -s * Math.PI / 2; flag.position.set(rf.cx + s * (bw / 2) - s * 22, 200 + ef, -lv.len);
        levelGroup.add(flag);
      });
      var line = new T.Mesh(new T.PlaneGeometry(rf.hw * 2, 24), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
      line.rotation.x = -Math.PI / 2; line.position.set(rf.cx, 3 + ef, -lv.len);
      levelGroup.add(line);

      // bodice ob bregovih
      var spikePts = [];
      (lv.spikes || []).forEach(function (sp) {
        for (var yy = sp[0]; yy <= sp[1]; yy += 28) {
          var rr = api.river(lv, yy);
          spikePts.push({ x: rr.cx - rr.hw + 2, y: yy, s: -1 }, { x: rr.cx + rr.hw - 2, y: yy, s: 1 });
        }
      });
      if (spikePts.length) {
        var spikes = new T.InstancedMesh(new T.ConeGeometry(8, 30, 5), mat(0xcbd5e1, { metalness: 0.4, roughness: 0.4 }), spikePts.length);
        var sq = new T.Quaternion(), se = new T.Euler(), one = new T.Vector3(1, 1, 1), sv = new T.Vector3(), sm = new T.Matrix4();
        spikePts.forEach(function (p, n) {
          se.set(0, 0, p.s * Math.PI / 2 * 0.85); sq.setFromEuler(se); // konica proti sredini reke
          sm.compose(sv.set(p.x, 9 + E(p.y), -p.y), sq, one);
          spikes.setMatrixAt(n, sm);
        });
        spikes.castShadow = true;
        levelGroup.add(spikes);
      }

      // zapornice
      var stripeCv = document.createElement("canvas");
      stripeCv.width = 64; stripeCv.height = 32;
      var sc2 = stripeCv.getContext("2d");
      sc2.fillStyle = "#dc2626"; sc2.fillRect(0, 0, 64, 32);
      sc2.fillStyle = "#f8fafc";
      sc2.beginPath(); sc2.moveTo(0, 32); sc2.lineTo(16, 0); sc2.lineTo(32, 0); sc2.lineTo(16, 32); sc2.fill();
      sc2.beginPath(); sc2.moveTo(32, 32); sc2.lineTo(48, 0); sc2.lineTo(64, 0); sc2.lineTo(48, 32); sc2.fill();
      lv.Gt.forEach(function (g) {
        var eg = E(g.y), o = { g: g, panels: [], lights: [] };
        [-1, 1].forEach(function (s) {
          var tx = new T.CanvasTexture(stripeCv);
          tx.wrapS = T.RepeatWrapping;
          var panel = mesh(new T.BoxGeometry(1, 26, api.GATE_R * 2), new T.MeshStandardMaterial({ map: tx, roughness: 0.6 }));
          panel.position.set(g.cx, 14 + eg, -g.y);
          levelGroup.add(panel);
          o.panels.push({ m: panel, s: s, tex: tx });
          var post = mesh(new T.CylinderGeometry(12, 14, 70, 8), mat(0x374151));
          post.position.set(g.cx + s * (g.hw + 26), 30 + eg, -g.y);
          levelGroup.add(post);
          var light = new T.Mesh(new T.SphereGeometry(9, 10, 8), new T.MeshBasicMaterial({ color: 0x22c55e }));
          light.position.set(g.cx + s * (g.hw + 26), 70 + eg, -g.y);
          levelGroup.add(light);
          o.lights.push(light);
        });
        gates.push(o);
      });
    }

    /* ---------- splavi (en ali več pri tekmi; zastavica v barvi ekipe) ---------- */
    var raftMeshes = [];
    function makeRaft() {
      var raft = new T.Group();
      scene.add(raft);
      var raftBody = new T.Group();
      raft.add(raftBody);
      var n = 6, pw = RAFT * 2 / n;
      for (var i = 0; i < n; i++) {
        var x = -RAFT + pw * (i + 0.5);
        var len = 2 * Math.sqrt(Math.max(0, RAFT * RAFT - x * x)) + 6;
        var lg = mesh(new T.CylinderGeometry(pw / 2, pw / 2, len, 8), mat(i % 2 ? 0xb7791f : 0xa16207));
        lg.rotation.x = Math.PI / 2; lg.position.set(x, 0, 0);
        raftBody.add(lg);
      }
      [-0.45, 0.45].forEach(function (z) {
        var beam = mesh(new T.BoxGeometry(RAFT * 1.9, 4, 7), mat(0x78350f));
        beam.position.set(0, pw / 2 + 1, z * RAFT * 2 * 0.6);
        raftBody.add(beam);
      });
      var rope = mesh(new T.TorusGeometry(RAFT - 3, 2.5, 6, 32), mat(0xe2c48a));
      rope.rotation.x = Math.PI / 2; rope.position.y = pw / 2 + 2;
      raftBody.add(rope);
      var flag = new T.Group();
      var pole = mesh(new T.CylinderGeometry(1.6, 1.6, 70, 6), mat(0x78350f));
      pole.position.y = 35 + pw / 2;
      flag.add(pole);
      var cloth = mesh(new T.BoxGeometry(34, 20, 1.5), mat(0xffffff));
      cloth.position.set(17, 60 + pw / 2, 0);
      flag.add(cloth);
      flag.visible = false;
      raftBody.add(flag);
      return { g: raft, body: raftBody, flag: flag, cloth: cloth, prevV: { x: 0, y: 0 }, tilt: { x: 0, z: 0 } };
    }
    function raftMesh(i) {
      while (raftMeshes.length <= i) raftMeshes.push(makeRaft());
      return raftMeshes[i];
    }
    raftMesh(0);
    var DECK = RAFT * 2 / 6 / 2 + 2;

    /* ---------- živali ---------- */
    var U = 17;
    function ball(r, c, x, y, z, sx, sy, sz) {
      var m = mesh(new T.SphereGeometry(r, 10, 8), mat(c));
      m.position.set(x, y, z); m.scale.set(sx || 1, sy || 1, sz || 1);
      return m;
    }
    function cone(r, h, c, x, y, z, rx, rz) {
      var m = mesh(new T.ConeGeometry(r, h, 6), mat(c));
      m.position.set(x, y, z); m.rotation.set(rx || 0, 0, rz || 0);
      return m;
    }
    function makeAnimal(slot) {
      var key = A[slot].key;
      var g = new T.Group();
      var body = new T.Group();
      g.add(body);
      var col = { krava: 0xf8fafc, pujs: 0xf9a8d4, koza: 0xd6b98c, raca: 0xfde047 }[key];
      var headCol = key === "koza" ? 0xe7d3ad : col;
      var duck = key === "raca";
      // noge
      if (!duck) [[-0.7, -0.5], [-0.7, 0.5], [0.7, -0.5], [0.7, 0.5]].forEach(function (p) {
        var leg = mesh(new T.CylinderGeometry(2.4, 2.4, 10, 5), mat(key === "pujs" ? 0xf472b6 : 0x374151));
        leg.position.set(p[0] * U, 5, p[1] * U);
        body.add(leg);
      });
      else [-0.4, 0.4].forEach(function (z) { body.add(cone(3, 8, 0xfb923c, 0, 4, z * U)); });
      var by = duck ? U * 0.95 : U * 1.25;
      body.add(ball(U, col, 0, by, 0, 1.25, duck ? 0.95 : 0.85, duck ? 1.0 : 0.9));
      if (key === "krava") {
        body.add(ball(U * 0.35, 0x1f2937, -U * 0.3, by + U * 0.55, -U * 0.4, 1, 0.5, 1));
        body.add(ball(U * 0.3, 0x1f2937, U * 0.3, by + U * 0.4, U * 0.55, 1, 0.6, 1));
      }
      if (duck) {
        [-1, 1].forEach(function (s) { body.add(ball(U * 0.7, 0xfacc15, -U * 0.15, by + U * 0.1, s * U * 0.8, 1, 0.45, 0.3)); });
      }
      // glava
      var head = new T.Group();
      head.position.set(duck ? U * 0.9 : U * 1.3, by + U * (duck ? 0.85 : 0.6), 0);
      body.add(head);
      var hr = U * (duck ? 0.62 : 0.68);
      head.add(ball(hr, headCol, 0, 0, 0));
      if (key === "krava") {
        head.add(ball(hr * 0.55, 0xfbcfe8, hr * 0.75, -hr * 0.25, 0, 0.8, 0.7, 1.2));
        [-1, 1].forEach(function (s) {
          head.add(cone(2.2, 9, 0xe7d3ad, -hr * 0.1, hr * 0.85, s * hr * 0.55, 0, 0));
          head.add(ball(hr * 0.35, col, -hr * 0.2, hr * 0.45, s * hr * 1.0, 0.6, 0.35, 1));
        });
      } else if (key === "pujs") {
        var sn = mesh(new T.CylinderGeometry(hr * 0.4, hr * 0.45, hr * 0.5, 10), mat(0xf472b6));
        sn.rotation.z = Math.PI / 2; sn.position.set(hr * 0.95, -hr * 0.1, 0);
        head.add(sn);
        [-1, 1].forEach(function (s) {
          head.add(ball(hr * 0.08, 0x9d174d, hr * 1.21, -hr * 0.1, s * hr * 0.15));
          head.add(cone(hr * 0.3, hr * 0.6, 0xf472b6, -hr * 0.1, hr * 0.85, s * hr * 0.5, s * 0.4, 0));
        });
        var tail = mesh(new T.TorusGeometry(3, 1, 4, 10, 5), mat(0xec4899));
        tail.position.set(-U * 1.35, by + U * 0.3, 0); tail.rotation.y = Math.PI / 2;
        body.add(tail);
      } else if (key === "koza") {
        [-1, 1].forEach(function (s) {
          head.add(cone(2.4, 14, 0x6b4f2a, -hr * 0.3, hr * 0.95, s * hr * 0.4, 0, 0.7));
          head.add(ball(hr * 0.3, headCol, -hr * 0.1, hr * 0.2, s * hr * 1.0, 0.7, 0.35, 1.2));
        });
        head.add(cone(3, 10, 0x8b6b3e, hr * 0.6, -hr * 1.0, 0, Math.PI, 0));
        head.add(ball(hr * 0.3, 0x8b6b3e, hr * 0.85, -hr * 0.15, 0, 1, 0.7, 1.1));
      } else {
        head.add(ball(hr * 0.5, 0xfb923c, hr * 1.0, -hr * 0.15, 0, 1.4, 0.45, 1.1));
      }
      [-1, 1].forEach(function (s) { head.add(ball(hr * 0.14, 0x111827, hr * 0.62, hr * 0.3, s * hr * 0.45)); });

      // obroč igralca
      var ring = new T.Mesh(new T.TorusGeometry(U * 1.75, 2.2, 6, 28), new T.MeshBasicMaterial({ color: new T.Color(A[slot].ring) }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 1;
      g.add(ring);

      // oblak, ki se nabira
      var cloud = new T.Mesh(new T.IcosahedronGeometry(U, 1), new T.MeshStandardMaterial({ color: 0xbef264, transparent: true, opacity: 0.6, flatShading: true }));
      cloud.position.set(-U * 1.7, by, 0);
      cloud.visible = false;
      g.add(cloud);

      scene.add(g);
      return { g: g, body: body, cloud: cloud, by: by, head: head };
    }
    var animals = {};

    /* ---------- delci ---------- */
    var MAXP = 600;
    var partMesh = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), new T.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), MAXP);
    partMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    partMesh.setColorAt(0, new T.Color(0xffffff));
    partMesh.frustumCulled = false;
    scene.add(partMesh);
    var pm = new T.Matrix4(), pq = new T.Quaternion(), ps = new T.Vector3(), pv = new T.Vector3(), pc = new T.Color(), pe = new T.Euler();

    /* ---------- kamera ---------- */
    var camPos = new T.Vector3(), camLook = new T.Vector3(), camInit = false;

    var W = 1, H = 1;
    function resize(w, h) {
      W = w; H = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function render(dt) {
      t += dt;
      var G = api.G;
      var lv = api.LEVELS[G.lv];
      if (G.lv !== levelIdx || lv.wk !== levelWk) { buildLevel(G.lv); camInit = false; }
      var cy0 = G.cam.y;

      // valovi
      var wpos = water.geometry.attributes.position, arr = wpos.array;
      var zMin = -(cy0 + 2200 / Math.min(1, G.zoom)), zMax = -(cy0 - 900);
      for (var i = 0; i < arr.length; i += 3) {
        var z = arr[i + 2];
        if (z < zMin || z > zMax) continue;
        arr[i + 1] = waterBase[i / 3] + wave(arr[i], z);
      }
      wpos.needsUpdate = true;
      water.geometry.computeVertexNormals();

      // splavi
      var k = 1 - Math.exp(-6 * dt);
      var info = G.rafts.map(function (r, i) {
        var m = raftMesh(i);
        var rx = r.x, rz = -r.y;
        var bob = wave(rx, rz) * 0.8;
        var drop = r.fall ? r.fall.t * r.fall.t * 420 : r.sink ? r.sink.t * 60 : 0; // padec čez rob / povodni mož
        m.g.position.set(rx, E(r.y) + 6 + bob - drop, rz);
        m.g.rotation.y = r.ang;
        m.g.rotation.x = Math.atan(visSlope(lv, r.y)); // nagib po klancu
        var ax = (r.vx - m.prevV.x) / Math.max(dt, 0.001), ay = (r.vy - m.prevV.y) / Math.max(dt, 0.001);
        m.prevV.x = r.vx; m.prevV.y = r.vy;
        m.tilt.x += (Math.max(-0.25, Math.min(0.25, -ay * 0.0006)) + Math.sin(t * 1.7 + i) * 0.03 - m.tilt.x) * k;
        m.tilt.z += (Math.max(-0.25, Math.min(0.25, ax * 0.0006)) + Math.sin(t * 1.3 + i) * 0.03 - m.tilt.z) * k;
        m.body.rotation.set(m.tilt.x * Math.cos(r.ang) - m.tilt.z * Math.sin(r.ang), 0, m.tilt.z * Math.cos(r.ang) + m.tilt.x * Math.sin(r.ang));
        var blink = r.inv > 0 && r.inv < 100 && Math.floor(r.inv * 10) % 2 === 0;
        m.g.visible = !blink && !r.out;
        m.flag.visible = !!G.race;
        if (G.race) m.cloth.material.color.set(api.TEAMS[r.team].c);
        return { rx: rx, rz: rz, bob: bob, drop: drop, blink: blink || r.out };
      });
      for (var ri = G.rafts.length; ri < raftMeshes.length; ri++) raftMeshes[ri].g.visible = false;

      // živali
      var seen = {};
      G.players.forEach(function (p) {
        var r = G.rafts[p.raft] || G.rafts[0], ii = info[G.rafts.indexOf(r)];
        var rx = ii.rx, rz = ii.rz, bob = ii.bob, drop = ii.drop, blink = ii.blink;
        var key = p.raft + ":" + p.slot + ":" + (p.uid || "");
        seen[key] = true;
        var an = animals[key] || (animals[key] = makeAnimal(p.slot));
        var a = r.ang + p.phi;
        var x = rx + Math.cos(a) * RAFT, wz = rz - Math.sin(a) * RAFT;
        var hop = p.puff > 0 ? Math.sin((0.35 - p.puff) / 0.35 * Math.PI) * 16 : 0;
        an.g.position.set(x, E(-wz) + 6 + bob + DECK + hop - drop, wz);
        an.g.rotation.y = a + Math.PI;
        var sw = 1 + 0.18 * p.charge + (p.holding ? Math.sin(t * 40) * 0.03 * p.charge : 0);
        an.body.scale.set(1, sw, sw);
        an.body.rotation.z = p.holding ? -0.15 * p.charge : 0;
        an.cloud.visible = p.charge > 0.05;
        var cs = 0.4 + 1.1 * p.charge;
        an.cloud.scale.set(cs, cs, cs);
        an.cloud.material.opacity = 0.3 + 0.45 * p.charge;
        an.g.visible = !blink;
      });
      Object.keys(animals).forEach(function (key) {
        if (seen[key]) return;
        scene.remove(animals[key].g);
        animals[key].g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        delete animals[key];
      });

      // ovire, ki se premikajo
      spinners.forEach(function (o) {
        o.g.rotation.y = api.spinAng(o.s); // svet (x, y) → 3D (x, -z): vrtenje okoli osi y se ujema
      });
      logs.forEach(function (o) {
        o.g.position.x = api.logX(o.l);
        o.g.position.y = 4 + E(o.l.y) + wave(o.g.position.x, -o.l.y) * 0.6;
        o.g.rotation.x = Math.sin(t * 2 + o.l.y) * 0.08;
      });
      pools.forEach(function (o) { o.g.rotation.y = t * 2.2 * o.p.str; });
      crocs3.forEach(function (o) {
        var x = api.crocX(o.c), v = api.crocV(o.c);
        var want = v >= 0 ? 0 : Math.PI;
        o.rot += (want - o.rot) * (1 - Math.exp(-4 * dt));
        o.g.position.set(x, E(o.c.y) + 5 + wave(x, -o.c.y) * 0.6, -o.c.y);
        o.g.rotation.y = o.rot;
        o.jaw.rotation.z = -(Math.sin(t * 5 + o.c.ph) + 1) * 0.22;
      });
      mozje3.forEach(function (o) {
        var near = 0;
        G.rafts.forEach(function (rr) {
          if (rr.out) return;
          near = Math.max(near, 1 - Math.min(1, (Math.hypot(rr.x - o.pm.x, rr.y - o.pm.y) - api.RC - api.PM_GRAB) / api.PM_WARN));
        });
        o.near += (near - o.near) * (1 - Math.exp(-5 * dt));
        var e = E(o.pm.y);
        o.g.position.y = e;
        o.body.position.y = -14 + o.near * 16 + Math.sin(t * 2 + o.pm.y) * 2; // ob splavu se dvigne iz vode
        o.swirl.rotation.z = t * 1.6;
        o.arms.forEach(function (a) { a.g.rotation.z = -a.s * (0.5 - o.near * 0.9); a.g.rotation.x = o.near * 0.9; });
      });
      buoys3.forEach(function (o) {
        o.g.visible = !o.b.taken;
        o.g.position.y = E(o.b.y) + 5 + wave(o.b.x, -o.b.y) * 0.7;
        o.g.rotation.y = t * 0.5;
      });
      flows.forEach(function (o) {
        var off = ((t * 50) % 60) - 30;
        o.m.position.set(o.x + Math.cos(o.a) * off, 4 + E(o.y) + wave(o.x, -o.y) * 0.5, -(o.y + Math.sin(o.a) * off));
      });
      // zapornice: dolžina vrat po reži, lučka zelena / rdeča
      gates.forEach(function (o) {
        var g = o.g;
        o.panels.forEach(function (p) {
          var x0 = p.s < 0 ? g.cx - g.hw - 20 : g.cx + g.gap;
          var x1 = p.s < 0 ? g.cx - g.gap : g.cx + g.hw + 20;
          var len = Math.max(0.01, x1 - x0);
          p.m.visible = x1 - x0 > 1;
          p.m.scale.x = len;
          p.m.position.x = (x0 + x1) / 2;
          p.tex.repeat.x = len / 52;
        });
        o.lights.forEach(function (l) { l.material.color.setHex(g.open > 0.5 ? 0x22c55e : 0xef4444); });
      });

      // delci
      var parts = G.parts, n = Math.min(parts.length, MAXP);
      for (var j = 0; j < n; j++) {
        var q = parts[j], kk = q.life / q.max;
        var size = q.grow ? q.r * (1 + kk * 1.6) * (1 - kk * 0.55) : q.r * (1 - kk);
        var h = q.grow ? 18 + kk * 45 : 6 + Math.sin(kk * Math.PI) * 30;
        pe.set(j, j * 0.7, 0); pq.setFromEuler(pe);
        pm.compose(pv.set(q.x, h + E(q.y), -q.y), pq, ps.set(size, size, size));
        partMesh.setMatrixAt(j, pm);
        partMesh.setColorAt(j, pc.set(q.col));
      }
      partMesh.count = n;
      partMesh.instanceMatrix.needsUpdate = true;
      if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;

      // kamera: zadaj in zgoraj, sledi splavu (pri tekmi težišču splavov, oddaljena po G.zoom)
      var portrait = H > W, zf = 1 / Math.max(0.3, G.zoom);
      var back = (portrait ? 560 : 380) * zf, up = (portrait ? 520 : 320) * zf;
      if (G.race) {
        // zadnji splav je razpon/2 za sredino: kamera mora biti dlje zadaj in višje
        back = Math.max(back, (portrait ? 560 : 380) + G.camSpan * 0.8);
        up = Math.max(up, (portrait ? 520 : 320) + G.camSpan * 0.7);
      }
      var tx = G.cam.x, ty = G.race ? G.cam.y - 40 : G.raft.y;
      var ey = E(ty);
      var wantPos = pv.set(tx, up + ey, -(ty - back));
      var wantLook = new T.Vector3(tx, (ey + E(ty + 220)) / 2, -(ty + 220));
      if (!camInit) { camPos.copy(wantPos); camLook.copy(wantLook); camInit = true; }
      var ck = 1 - Math.exp(-3 * dt);
      camPos.lerp(wantPos, ck);
      camLook.lerp(wantLook, ck);
      camera.position.copy(camPos);
      if (G.shake > 0) camera.position.add(new T.Vector3((Math.random() - 0.5) * 24 * G.shake, (Math.random() - 0.5) * 24 * G.shake, 0));
      camera.lookAt(camLook);

      var se = Math.round(600 * Math.min(2.2, zf) / 50) * 50; // senca pokrije vse splave
      if (sc.right !== se) { sc.left = -se; sc.right = se; sc.top = se; sc.bottom = -se; sc.updateProjectionMatrix(); }
      sun.position.set(tx + 350, 700 + ey, -ty + 250);
      sun.target.position.set(tx, ey, -ty - 150);

      renderer.render(scene, camera);
    }

    // svet (x, y, višina) → zaslon, za imena nad živalmi
    var pj = new T.Vector3();
    function project(x, y, h) {
      pj.set(x, h, -y).project(camera);
      return { x: (pj.x + 1) / 2 * W, y: (1 - pj.y) / 2 * H, front: pj.z < 1 };
    }

    function animalTop(p) {
      var key = p.raft + ":" + p.slot + ":" + (p.uid || "");
      var an = animals[key];
      return an ? an.g.position.y + an.by + U * 3.4 : 80;
    }

    return { render: render, resize: resize, project: project, animalTop: animalTop };
  }

  window.PRDO3D = { create: create };
})();

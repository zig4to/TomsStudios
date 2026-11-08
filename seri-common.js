/* Šeri — skupni pripomočki za stran Šeri (seri.js) in prejem na plošči (inbox.js). */
(function () {
  "use strict";

  var MAX_BYTES = 50 * 1024 * 1024; // = file_size_limit bucketa seri
  var BUCKET = "seri";

  // Barva ikone po vrsti datoteke: [začetna, končna] barva preliva.
  var KINDS = [
    { test: /^image\//, exts: /^(jpe?g|png|gif|webp|heic|heif|avif|svg|bmp|tiff?|raw|dng|cr2|nef)$/, colors: ["#f472b6", "#a855f7"] },
    { test: /^video\//, exts: /^(mp4|mov|m4v|avi|mkv|webm|3gp)$/, colors: ["#fb7185", "#f97316"] },
    { test: /^audio\//, exts: /^(mp3|m4a|wav|flac|aac|ogg|opus)$/, colors: ["#facc15", "#f97316"] },
    { test: /pdf$/, exts: /^pdf$/, colors: ["#f87171", "#dc2626"] },
    { test: /zip|rar|7z|tar|gzip/, exts: /^(zip|rar|7z|tar|gz|tgz)$/, colors: ["#a3a3a3", "#525252"] },
    { test: /sheet|excel|csv/, exts: /^(xlsx?|csv|ods|numbers)$/, colors: ["#4ade80", "#15803d"] },
    { test: /word|document|text/, exts: /^(docx?|odt|rtf|txt|md|pages)$/, colors: ["#60a5fa", "#1d4ed8"] },
    { test: /presentation|powerpoint/, exts: /^(pptx?|odp|key)$/, colors: ["#fb923c", "#c2410c"] }
  ];
  var DEFAULT_COLORS = ["#22d3ee", "#6366f1"];

  function ext(name) {
    var m = /\.([^.\/\\]{1,10})$/.exec(name || "");
    return m ? m[1].toLowerCase() : "";
  }

  function kindColors(name, mime) {
    var e = ext(name);
    mime = (mime || "").toLowerCase();
    for (var i = 0; i < KINDS.length; i++) {
      if ((mime && KINDS[i].test.test(mime)) || (e && KINDS[i].exts.test(e))) return KINDS[i].colors;
    }
    return DEFAULT_COLORS;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    var units = ["kB", "MB", "GB"];
    var v = bytes / 1024;
    var i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return v.toLocaleString("sl-SI", { maximumFractionDigits: v < 10 ? 1 : 0 }) + " " + units[i];
  }

  // Barvni par za avatar uporabnika (stabilen po id-ju).
  var PERSON_COLORS = [
    ["#a855f7", "#6366f1"], ["#ec4899", "#f43f5e"], ["#22d3ee", "#0ea5e9"], ["#f59e0b", "#ef4444"],
    ["#4ade80", "#0d9488"], ["#818cf8", "#c026d3"], ["#fb923c", "#db2777"], ["#2dd4bf", "#4f46e5"]
  ];
  function personColors(id) {
    var h = 0;
    for (var i = 0; i < (id || "").length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return PERSON_COLORS[h % PERSON_COLORS.length];
  }

  function initials(name) {
    var parts = (name || "?").trim().split(/\s+/);
    var s = parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : "");
    return s.toUpperCase();
  }

  // Leno čiščenje (hramba 24 ur): potekli prenosi, kjer sem pošiljatelj ali
  // prejemnik (najprej datoteke, ker prejemnikovo pravico do brisanja datoteke
  // daje obstoječa vrstica), nato osirotele datoteke v moji mapi, starejše od 24 h.
  function cleanup(sb, uid) {
    var nowIso = new Date().toISOString();
    return sb.from("seri_transfers").select("id, path").lt("expires_at", nowIso)
      .then(function (res) {
        var old = (res && res.data) || [];
        if (!old.length) return;
        return sb.storage.from(BUCKET).remove(old.map(function (o) { return o.path; }))
          .then(function () {
            return sb.from("seri_transfers").delete().in("id", old.map(function (o) { return o.id; }));
          });
      })
      .then(function () {
        return sb.storage.from(BUCKET).list(uid, { limit: 200 });
      })
      .then(function (res) {
        var cutoff = Date.now() - 24 * 3600 * 1000;
        var stale = ((res && res.data) || [])
          .filter(function (f) { return f.created_at && Date.parse(f.created_at) < cutoff; })
          .map(function (f) { return uid + "/" + f.name; });
        if (stale.length) return sb.storage.from(BUCKET).remove(stale);
      })
      .catch(function () { /* čiščenje ni kritično */ });
  }

  /* ---------- Animacija prenosa: ikona razpade v delce / se sestavi iz njih ----------
     Pošiljatelj: mode "out" — celice po vrsticah od zgoraj odletijo v cilj (avatar).
     Prejemnik:   mode "in"  — celice v istem vrstnem redu priletijo iz vira in sestavijo ikono.
     Oba tečeta enako dolgo, zato je loader na obeh napravah usklajen. */
  var DOC_PATH = "M14 4h66l36 36v96a10 10 0 0 1-10 10H14A10 10 0 0 1 4 136V14A10 10 0 0 1 14 4Z";
  var FOLD_PATH = "M80 4v26a10 10 0 0 0 10 10h26Z";
  var IW = 120, IH = 150, CELL = 5, RES = 3, TRAIL = 0.16;
  var DURATION = 2600;

  function makeIcon(name, mime) {
    var colors = kindColors(name, mime);
    var off = document.createElement("canvas");
    off.width = IW * RES; off.height = IH * RES;
    var o = off.getContext("2d");
    o.scale(RES, RES);
    var g = o.createLinearGradient(0, 0, IW, IH);
    g.addColorStop(0, colors[0]); g.addColorStop(1, colors[1]);
    o.fillStyle = g; o.fill(new Path2D(DOC_PATH));
    o.fillStyle = "rgba(255,255,255,.45)"; o.fill(new Path2D(FOLD_PATH));
    var label = (ext(name) || "file").toUpperCase().slice(0, 5);
    o.fillStyle = "#fff";
    o.font = "800 " + (label.length > 3 ? 18 : 22) + "px Outfit, system-ui, sans-serif";
    o.textAlign = "center";
    o.fillText(label, IW / 2, 112);

    var data = o.getImageData(0, 0, off.width, off.height).data;
    var cells = [];
    for (var y = 0; y < IH; y += CELL) {
      for (var x = 0; x < IW; x += CELL) {
        var px = ((y + CELL / 2) * RES | 0) * off.width + ((x + CELL / 2) * RES | 0);
        if (data[px * 4 + 3] < 20) continue;
        cells.push({ x: x, y: y, t: (y / IH) * 0.8 + Math.random() * 0.2, dx: Math.random() - .5, spin: Math.random() * 2 - 1 });
      }
    }
    return { canvas: off, cells: cells };
  }

  function ease(k) { return k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }

  // opts: { icon, mode, rect: () => DOMRect|null (kje je ikona), point: () => {x,y} (cilj/vir),
  //         onProgress(0..1), onDone(), duration }
  function transfer(opts) {
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var dur = reduce ? 600 : (opts.duration || DURATION);
    var cv = document.createElement("canvas");
    cv.className = "seri-fx";
    cv.setAttribute("aria-hidden", "true");
    cv.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:1200";
    document.body.appendChild(cv);
    var ctx = cv.getContext("2d");
    var cw = 0, ch = 0, dpr = 1, t0 = performance.now(), stopped = false, finished = false;
    var icon = opts.icon, cells = icon.canvas ? icon.cells : [];

    function size() {
      dpr = window.devicePixelRatio || 1;
      if (cw !== innerWidth || ch !== innerHeight) {
        cw = innerWidth; ch = innerHeight;
        cv.width = cw * dpr; cv.height = ch * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function cell(c, ox, oy, s, dx, dy, alpha, rot, scale) {
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      var cx = ox + (c.x + CELL / 2) * s + dx, cy = oy + (c.y + CELL / 2) * s + dy;
      var w = CELL * s * scale;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(cx, cy);
      if (rot) ctx.rotate(rot);
      ctx.drawImage(icon.canvas, c.x * RES, c.y * RES, CELL * RES, CELL * RES, -w / 2, -w / 2, w + .6, w + .6);
    }

    function frame(now) {
      if (stopped) return;
      var r = opts.rect();
      if (!r) { finished = true; stop(); if (opts.onDone) opts.onDone(); return; }
      size();
      ctx.clearRect(0, 0, cw, ch);
      var p = Math.min(1 + TRAIL, ((now - t0) / dur) * (1 + TRAIL));
      // ikona 120×150 umeščena (contain) v pravokotnik
      var s = Math.min(r.width / IW, r.height / IH);
      var ox = r.left + (r.width - IW * s) / 2, oy = r.top + (r.height - IH * s) / 2;
      var pt = opts.point();
      var out = opts.mode === "out";

      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        var a = reduce ? (p >= 1 ? 1 : -1) : (p - c.t) / TRAIL; // <0 čaka, 0..1 leti, >1 končano
        var hx = ox + (c.x + CELL / 2) * s, hy = oy + (c.y + CELL / 2) * s;
        if (out) {
          if (a < 0) cell(c, ox, oy, s, 0, 0, 1, 0, 1);
          else if (a < 1) {
            var e = ease(a), arc = Math.sin(a * Math.PI);
            cell(c, ox, oy, s, (pt.x - hx) * e + c.dx * 40 * arc, (pt.y - hy) * e - 24 * arc,
              1 - a * .85, c.spin * a * 3, 1 - a * .6);
          }
        } else {
          if (a >= 1) cell(c, ox, oy, s, 0, 0, 1, 0, 1);
          else if (a > 0) {
            var e2 = ease(a), arc2 = Math.sin(a * Math.PI);
            cell(c, ox, oy, s, (pt.x - hx) * (1 - e2) + c.dx * 30 * arc2, (pt.y - hy) * (1 - e2),
              .25 + a * .75, c.spin * (1 - a) * 3, 1.6 - a * .6);
          }
        }
      }
      // svetla črta na robu razpadanja/sestavljanja
      if (!reduce && p > 0 && p < 1 + TRAIL * .5) {
        var ey = oy + (Math.min(1, p) * .8 + .1) * IH * s, ew = IW * s;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "lighter";
        var gr = ctx.createLinearGradient(ox - 10, 0, ox + ew + 10, 0);
        gr.addColorStop(0, "rgba(255,255,255,0)");
        gr.addColorStop(.5, "rgba(255,255,255,.9)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gr;
        ctx.shadowColor = "#22d3ee";
        ctx.shadowBlur = 14;
        ctx.fillRect(ox - 10, ey - 1.5, ew + 20, 3);
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = "source-over";
      }

      if (opts.onProgress) opts.onProgress(ease(Math.min(1, p / (1 + TRAIL))));
      if (p >= 1 + TRAIL) { finished = true; stop(); if (opts.onDone) opts.onDone(); return; }
      requestAnimationFrame(frame);
    }

    function stop() {
      stopped = true;
      if (cv.parentNode) cv.parentNode.removeChild(cv);
    }

    requestAnimationFrame(frame);
    return { cancel: function () { if (!finished) stop(); } };
  }

  window.SERI = {
    makeIcon: makeIcon,
    transfer: transfer,
    TRANSFER_MS: DURATION,
    MAX_BYTES: MAX_BYTES,
    BUCKET: BUCKET,
    ext: ext,
    kindColors: kindColors,
    formatSize: formatSize,
    personColors: personColors,
    initials: initials,
    cleanup: cleanup
  };
})();

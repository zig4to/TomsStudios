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

  window.SERI = {
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

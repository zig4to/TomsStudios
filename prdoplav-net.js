/* Prdoplav — skupno gostitelju (prdoplav.html) in kontrolerju (prdoplav-kontroler.html).
   Soba = Supabase Realtime kanal „prdoplav-<KODA>“ (broadcast + presence, brez tabel).
   Gostitelj ima presence ključ „host“, kontrolerji svoj user id.
   Sporočila:
     in  (telefon → gostitelj)  { u, l, r, f }           levo / desno / prdec (držim)
     cmd (telefon → gostitelj)  { u, a }                 a = "start" | "next" | "retry"
     st  (gostitelj → telefoni) { ph, lv, lvName, lives, next, p: [{ u, s, g, c, w }] } */
(function () {
  "use strict";

  var LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

  // Vrstni red = mesto na splavu (P1 … P4).
  var ANIMALS = [
    { key: "krava", name: "Krava", ring: "#ef4444" },
    { key: "pujs", name: "Pujs", ring: "#3b82f6" },
    { key: "koza", name: "Koza", ring: "#22c55e" },
    { key: "raca", name: "Raca", ring: "#f59e0b" }
  ];

  function client() {
    if (!window.supabase || !window.SUPABASE_URL) return null;
    return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }

  function newCode() {
    var s = "";
    for (var i = 0; i < 4; i++) s += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    return s;
  }

  function cleanCode(s) {
    return String(s || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  }

  function channel(sb, code, key) {
    return sb.channel("prdoplav-" + code, {
      config: { presence: { key: key }, broadcast: { self: false } }
    });
  }

  // Ime iz profila TomsStudia (seri_users), sicer del e-pošte.
  function myName(sb, user) {
    var fallback = ((user && user.email) || "Igralec").split("@")[0];
    return sb.rpc("seri_users").then(function (res) {
      var list = (res && res.data) || [];
      for (var i = 0; i < list.length; i++) if (list[i].id === user.id && list[i].name) return list[i].name;
      return fallback;
    }, function () { return fallback; });
  }

  function controllerUrl(code, base) {
    return new URL("prdoplav-kontroler.html?soba=" + code, base || location.href).toString();
  }

  // Na localhost telefon strani ne doseže → vrni naslov z IP-jem računalnika v omrežju
  // (dev strežnik ga pove na /__lan). Drugje ostane trenutni naslov.
  function joinBase() {
    var h = location.hostname;
    if (h !== "localhost" && h !== "127.0.0.1" && h !== "[::1]") return Promise.resolve(location.href);
    return fetch("/__lan", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
      var ips = (d && d.ips) || [];
      var pick = ips.filter(function (ip) { return /^192\.168\./.test(ip); })[0] ||
        ips.filter(function (ip) { return /^(10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip); })[0] || ips[0];
      if (!pick) return location.href;
      return location.protocol + "//" + pick + ":" + (location.port || d.port) + location.pathname;
    }).catch(function () { return location.href; });
  }

  window.PRDONET = {
    ANIMALS: ANIMALS,
    EV: { IN: "in", CMD: "cmd", ST: "st" },
    client: client,
    newCode: newCode,
    cleanCode: cleanCode,
    channel: channel,
    myName: myName,
    controllerUrl: controllerUrl,
    joinBase: joinBase
  };
})();

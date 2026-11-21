/* Prdoplav — skupno gostitelju (prdoplav.html) in kontrolerju (prdoplav-kontroler.html).
   Soba = Supabase Realtime kanal „prdoplav-<KODA>“ (broadcast + presence, brez tabel).
   Gostitelj ima presence ključ „host“, kontrolerji svoj user id.
   Sporočila:
     in  (telefon → gostitelj)  { u, l, r, f }           levo / desno / prdec (držim)
     cmd (telefon → gostitelj)  { u, a, t }              a = "start" | "next" | "retry" | "team" (t = ekipa)
     st  (gostitelj → telefoni) { ph, lv, lvName, lives, next, ts, teams, rafts, p: [{ u, s, t, g, c, w, f }] }
       ts = igralcev na splav (0 = vsi na enem), teams = [{ n }] zasedenost ekip v sobi,
       rafts = [{ t, lives, done, out, place }] med tekmo, p.t = ekipa igralca */
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

  // Tekma več splavov: barva in ime splava (ekipe). Barve se ne prekrivajo z obroči živali.
  var TEAMS = [
    { name: "Vijolični", c: "#a855f7" },
    { name: "Turkizni", c: "#06b6d4" },
    { name: "Rožnati", c: "#ec4899" },
    { name: "Beli", c: "#e2e8f0" }
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

  // Skupni kanal, kjer se odprte sobe oglasijo (presence ključ = koda sobe,
  // meta { code, name, n, at }). Telefon tako najde sobo brez vpisovanja kode.
  function lobbyChannel(sb, key) {
    return channel(sb, "lobby", key);
  }
  function openRooms(lobby) {
    var st = lobby.presenceState(), out = [];
    Object.keys(st).forEach(function (k) {
      var m = st[k] && st[k][0];
      if (m && m.code) out.push({ code: m.code, name: m.name || "Soba", n: m.n || 0, at: m.at || 0 });
    });
    return out.sort(function (a, b) { return b.at - a.at; });
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
    TEAMS: TEAMS,
    EV: { IN: "in", CMD: "cmd", ST: "st" },
    client: client,
    newCode: newCode,
    cleanCode: cleanCode,
    channel: channel,
    myName: myName,
    controllerUrl: controllerUrl,
    lobbyChannel: lobbyChannel,
    openRooms: openRooms,
    joinBase: joinBase
  };
})();

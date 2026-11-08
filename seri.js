/* Šeri — stran za pošiljanje datotek (seri.html).
   1) izberi prejemnika (zgoraj), 2) tapni velik „+“ in izberi datoteko —
   nalaganje v Supabase Storage se začne takoj, v izvirni obliki,
   3) povleci kartico datoteke gor (ali „Pošlji“) → vrstica v seri_transfers,
   prejemnik jo v živo vidi na vrhu plošče (inbox.js). */
(function () {
  "use strict";

  var S = window.SERI;
  var $ = function (id) { return document.getElementById(id); };

  var gate = $("seriGate");
  var appEl = $("seriApp");
  var peopleEl = $("seriPeople");
  var toEl = $("seriTo");
  var plusBtn = $("seriPlus");
  var plusHint = $("seriPlusHint");
  var input = $("seriInput");
  var fileWrap = $("seriFile");
  var card = $("seriFileCard");
  var doc = $("seriDoc");
  var liquid = $("seriLiquid");
  var extEl = $("seriDocExt");
  var nameEl = $("seriFileName");
  var metaEl = $("seriFileMeta");
  var progress = $("seriProgress");
  var progressFill = $("seriProgressFill");
  var progressPct = $("seriProgressPct");
  var swipeHint = $("seriSwipeHint");
  var sendBtn = $("seriSend");
  var cancelBtn = $("seriCancel");
  var dropEl = $("seriDrop");

  if (!window.SUPABASE_URL || !window.supabase) {
    gate.textContent = "Supabase ni nastavljen.";
    return;
  }
  var sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  var session = null;
  var people = [];
  var recipientId = null;
  var RECIPIENT_KEY = "seri-recipient";

  // Trenutna datoteka: { file, path, xhr, done, failed, promise, pct, sending }
  var cur = null;

  /* ---------- Pomožno ---------- */

  function toast(text) {
    var t = $("seriToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "seriToast";
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.classList.add("is-visible");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("is-visible"); }, 3200);
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  }

  function personById(id) {
    for (var i = 0; i < people.length; i++) if (people[i].id === id) return people[i];
    return null;
  }

  /* ---------- Prejemniki ---------- */

  var PHONE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="13" height="10" rx="1.5"/><path d="M5 18h7"/><rect x="16" y="8" width="6" height="12" rx="1.5"/></svg>';
  var CHECK_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  function renderPeople() {
    peopleEl.innerHTML = "";
    people.forEach(function (p) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "seri-person";
      btn.setAttribute("role", "option");
      btn.setAttribute("data-id", p.id);
      btn.setAttribute("aria-selected", p.id === recipientId ? "true" : "false");
      var c = S.personColors(p.id);
      var av = document.createElement("span");
      av.className = "seri-avatar";
      av.style.setProperty("--pa", c[0]);
      av.style.setProperty("--pb", c[1]);
      if (p.me) av.innerHTML = PHONE_ICON;
      else av.textContent = S.initials(p.name);
      var nm = document.createElement("span");
      nm.className = "seri-person-name";
      nm.textContent = p.me ? "Jaz" : p.name.split(/\s+/)[0];
      btn.title = p.me ? "Jaz — na drugo napravo" : p.name;
      btn.appendChild(av);
      btn.appendChild(nm);
      btn.addEventListener("click", function () { selectRecipient(p.id); });
      peopleEl.appendChild(btn);
    });
  }

  function selectRecipient(id) {
    recipientId = id;
    try { localStorage.setItem(RECIPIENT_KEY, id); } catch (e) {}
    var btns = peopleEl.querySelectorAll(".seri-person");
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute("data-id") === id;
      btns[i].setAttribute("aria-selected", on ? "true" : "false");
      if (on && btns[i].scrollIntoView) btns[i].scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }
    renderTo();
  }

  function renderTo() {
    var p = personById(recipientId);
    if (!cur || !p) { toEl.hidden = true; return; }
    toEl.hidden = false;
    toEl.innerHTML = "";
    toEl.appendChild(document.createTextNode(p.me ? "na tvojo drugo napravo" : "za"));
    var strong = document.createElement("strong");
    strong.textContent = p.me ? "Jaz" : p.name;
    toEl.appendChild(strong);
  }

  function recipientButton() {
    return peopleEl.querySelector('.seri-person[data-id="' + recipientId + '"]');
  }

  /* ---------- Izbira datoteke ---------- */

  plusBtn.addEventListener("click", function () { input.click(); });
  input.addEventListener("change", function () {
    if (input.files && input.files[0]) pickFile(input.files[0]);
    input.value = "";
  });

  // Spust datoteke na računalniku.
  var dragDepth = 0;
  window.addEventListener("dragenter", function (e) {
    if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") === -1) return;
    e.preventDefault();
    dragDepth++;
    dropEl.hidden = false;
  });
  window.addEventListener("dragover", function (e) { e.preventDefault(); });
  window.addEventListener("dragleave", function () {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropEl.hidden = true;
  });
  window.addEventListener("drop", function (e) {
    e.preventDefault();
    dragDepth = 0;
    dropEl.hidden = true;
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && !appEl.hidden) pickFile(f);
  });

  function hideDrop() { dragDepth = 0; dropEl.hidden = true; }
  dropEl.addEventListener("click", hideDrop);
  window.addEventListener("keydown", function (e) { if (e.key === "Escape") hideDrop(); });
  window.addEventListener("dragend", hideDrop);

  function pickFile(file) {
    if (cur) discard();
    if (file.size > S.MAX_BYTES) {
      toast("Datoteka je prevelika (" + S.formatSize(file.size) + "). Največ 50 MB.");
      return;
    }
    if (!recipientId) { toast("Najprej izberi, komu pošlješ."); return; }

    cur = { file: file, path: session.user.id + "/" + uuid(), done: false, failed: false, pct: 0, sending: false };

    var colors = S.kindColors(file.name, file.type);
    doc.style.setProperty("--doc-a", colors[0]);
    doc.style.setProperty("--doc-b", colors[1]);
    card.style.setProperty("--doc-a", colors[0]);
    card.style.setProperty("--doc-b", colors[1]);
    extEl.textContent = (S.ext(file.name) || "file").toUpperCase();
    nameEl.textContent = file.name || "datoteka";
    metaEl.textContent = S.formatSize(file.size);
    setFill(0);
    progress.hidden = true;
    card.classList.remove("is-uploading", "is-flying", "is-returning");
    card.style.transform = "";
    card.style.opacity = "";

    plusBtn.hidden = true;
    plusHint.hidden = true;
    fileWrap.hidden = false;
    swipeHint.hidden = false;
    sendBtn.disabled = false;
    sendBtn.textContent = "Pošlji";
    renderTo();

    startUpload(cur);
  }

  /* ---------- Nalaganje (XHR zaradi napredka; izvirna datoteka, brez stiskanja) ---------- */

  function setFill(pct) {
    // tekočina: y = 150 (prazno) … -12 (polno, nad robom vala)
    var y = 150 - (pct / 100) * 162;
    liquid.style.transform = "translateY(" + y.toFixed(1) + "px)"; // CSS → gladek prehod
    progressFill.style.width = pct + "%";
    progressPct.textContent = Math.round(pct) + " %";
  }

  function startUpload(c) {
    // Dolgo nalaganje → po 350 ms pokaži vrstico napredka in orbito.
    var slowTimer = setTimeout(function () {
      if (cur === c && !c.done) {
        progress.hidden = false;
        card.classList.add("is-uploading");
      }
    }, 350);

    c.promise = sb.auth.getSession().then(function (res) {
      var s = (res && res.data && res.data.session) || session;
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        c.xhr = xhr;
        xhr.open("POST", window.SUPABASE_URL + "/storage/v1/object/" + S.BUCKET + "/" + c.path);
        xhr.setRequestHeader("Authorization", "Bearer " + s.access_token);
        xhr.setRequestHeader("apikey", window.SUPABASE_ANON_KEY);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.setRequestHeader("Content-Type", c.file.type || "application/octet-stream");
        xhr.upload.onprogress = function (e) {
          if (!e.lengthComputable || cur !== c) return;
          c.pct = Math.min(99, (e.loaded / e.total) * 100);
          setFill(c.pct);
        };
        xhr.onload = function () {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(uploadError(xhr)));
        };
        xhr.onerror = function () { reject(new Error("Nalaganje ni uspelo. Preveri povezavo.")); };
        xhr.onabort = function () { reject(new Error("abort")); };
        xhr.send(c.file);
      });
    }).then(function () {
      clearTimeout(slowTimer);
      c.done = true;
      if (cur !== c) return;
      c.pct = 100;
      setFill(100);
      setTimeout(function () {
        if (cur === c) { progress.hidden = true; card.classList.remove("is-uploading"); }
      }, 500);
    }, function (err) {
      clearTimeout(slowTimer);
      c.failed = true;
      if (err.message !== "abort" && cur === c) {
        toast(err.message);
        reset();
      }
      throw err;
    });
    c.promise.catch(function () {});
  }

  function uploadError(xhr) {
    try {
      var j = JSON.parse(xhr.responseText);
      var msg = (j && (j.message || j.error)) || "";
      if (/size|large/i.test(msg) || xhr.status === 413) return "Datoteka je prevelika (največ 50 MB).";
      if (msg) return "Nalaganje ni uspelo: " + msg;
    } catch (e) {}
    return "Nalaganje ni uspelo (" + xhr.status + ").";
  }

  /* ---------- Pošiljanje ---------- */

  sendBtn.addEventListener("click", function () { send(); });
  cancelBtn.addEventListener("click", function () { discard(); reset(); });

  function send() {
    var c = cur;
    if (!c || c.sending) return;
    var to = recipientId;
    if (!to) { toast("Izberi, komu pošlješ."); springBack(); return; }
    c.sending = true;
    sendBtn.disabled = true;
    sendBtn.textContent = "Pošiljam …";

    if (!c.done) {
      // Nalaganje še teče: kartica počaka na sredini z napredkom.
      springBack();
      progress.hidden = false;
      card.classList.add("is-uploading");
    }

    c.promise
      .then(function () {
        return sb.from("seri_transfers").insert({
          recipient_id: to,
          path: c.path,
          name: c.file.name || "datoteka",
          size: c.file.size,
          mime: c.file.type || null
        });
      })
      .then(function (res) {
        if (res && res.error) throw new Error("Pošiljanje ni uspelo.");
        if (cur !== c) return;
        flyTo(to);
      })
      .catch(function (err) {
        if (cur !== c) return;
        c.sending = false;
        sendBtn.disabled = false;
        sendBtn.textContent = "Pošlji";
        if (err && err.message && err.message !== "abort" && !c.failed) toast(err.message);
        springBack();
      });
  }

  function flyTo(id) {
    var target = peopleEl.querySelector('.seri-person[data-id="' + id + '"] .seri-avatar');
    var cr = card.getBoundingClientRect();
    var tr = target ? target.getBoundingClientRect() : { left: cr.left, top: -100, width: 0, height: 0 };
    var dx = tr.left + tr.width / 2 - (cr.left + cr.width / 2);
    var dy = tr.top + tr.height / 2 - (cr.top + cr.height / 2);
    swipeHint.hidden = true;
    card.classList.remove("is-dragging", "is-returning");
    card.classList.add("is-flying");
    // naslednji okvir, da prehod začne iz trenutnega položaja
    requestAnimationFrame(function () {
      card.style.transform = "translate(" + dx + "px," + dy + "px) scale(.08) rotate(-18deg)";
      card.style.opacity = "0";
    });
    setTimeout(function () {
      var btn = peopleEl.querySelector('.seri-person[data-id="' + id + '"]');
      if (btn) {
        btn.classList.remove("is-target");
        btn.classList.add("is-hit");
        var check = document.createElement("span");
        check.className = "seri-person-check";
        check.innerHTML = CHECK_ICON;
        btn.querySelector(".seri-avatar").appendChild(check);
        setTimeout(function () { btn.classList.remove("is-hit"); check.remove(); }, 1600);
      }
      if (target) burst(tr.left + tr.width / 2, tr.top + tr.height / 2, card.style.getPropertyValue("--doc-a"), card.style.getPropertyValue("--doc-b"));
      var p = personById(id);
      toast(p && p.me ? "Poslano na tvojo drugo napravo ✓" : "Poslano: " + (p ? p.name : "") + " ✓");
      cur = null;
      reset();
    }, 560);
  }

  function burst(x, y, a, b) {
    for (var i = 0; i < 16; i++) {
      var s = document.createElement("span");
      s.className = "seri-spark";
      var ang = (Math.PI * 2 * i) / 16 + Math.random() * .4;
      var dist = 40 + Math.random() * 50;
      s.style.left = x - 4 + "px";
      s.style.top = y - 4 + "px";
      s.style.background = i % 2 ? (a || "#a855f7") : (b || "#22d3ee");
      s.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      s.style.setProperty("--dy", Math.sin(ang) * dist + "px");
      document.body.appendChild(s);
      setTimeout(s.remove.bind(s), 900);
    }
  }

  // Zavrže trenutno datoteko (prekine nalaganje / pobriše že naloženo).
  function discard() {
    var c = cur;
    if (!c) return;
    cur = null;
    if (c.xhr && !c.done) { try { c.xhr.abort(); } catch (e) {} }
    else if (c.done && !c.sending) sb.storage.from(S.BUCKET).remove([c.path]).catch(function () {});
  }

  function reset() {
    cur = null;
    fileWrap.hidden = true;
    plusBtn.hidden = false;
    plusHint.hidden = false;
    toEl.hidden = true;
    card.classList.remove("is-uploading", "is-flying", "is-returning", "is-dragging");
    card.style.transform = "";
    card.style.opacity = "";
    clearTarget();
  }

  /* ---------- Poteg gor (prst ali miška) ---------- */

  var drag = null;

  function threshold() {
    // dovolj visoko: nad sredino med kartico in trakom uporabnikov, a vsaj 90 px
    var cr = card.getBoundingClientRect();
    var pr = peopleEl.getBoundingClientRect();
    return Math.max(90, Math.min(160, (cr.top - pr.bottom) * .6 + 60));
  }

  function clearTarget() {
    var t = peopleEl.querySelector(".seri-person.is-target");
    if (t) t.classList.remove("is-target");
  }

  card.addEventListener("pointerdown", function (e) {
    if (!cur || cur.sending || (e.pointerType === "mouse" && e.button !== 0)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, th: threshold() };
    card.setPointerCapture(e.pointerId);
    card.classList.remove("is-returning");
    card.classList.add("is-dragging");
  });

  card.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dy = e.clientY - drag.y;
    var dx = e.clientX - drag.x;
    // navzdol z uporom, vstran rahlo
    drag.dy = dy > 0 ? dy * .25 : dy;
    drag.dx = dx * .35;
    var k = Math.min(1, Math.max(0, -drag.dy / drag.th));
    card.style.transform =
      "translate(" + drag.dx + "px," + drag.dy + "px) scale(" + (1 - k * .12) + ") rotate(" + drag.dx * .05 + "deg)";
    var btn = recipientButton();
    if (btn) btn.classList.toggle("is-target", k >= 1);
    swipeHint.style.opacity = String(1 - k);
  });

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var passed = -drag.dy >= drag.th;
    drag = null;
    card.classList.remove("is-dragging");
    swipeHint.style.opacity = "";
    if (passed) send();
    else springBack();
  }
  card.addEventListener("pointerup", endDrag);
  card.addEventListener("pointercancel", endDrag);

  function springBack() {
    clearTarget();
    card.classList.remove("is-dragging");
    card.classList.add("is-returning");
    card.style.transform = "";
    setTimeout(function () { card.classList.remove("is-returning"); }, 460);
  }

  /* ---------- Zagon ---------- */

  function start(s) {
    session = s;
    sb.rpc("seri_users").then(function (res) {
      if (res.error) {
        gate.textContent = "Šeri še ni pripravljen (baza). Poskusi kasneje.";
        return;
      }
      var me = null;
      var others = [];
      (res.data || []).forEach(function (u) {
        if (u.id === s.user.id) me = { id: u.id, name: u.name, me: true };
        else others.push({ id: u.id, name: u.name || "Uporabnik" });
      });
      people = (me ? [me] : [{ id: s.user.id, name: "Jaz", me: true }]).concat(others);
      var saved = null;
      try { saved = localStorage.getItem(RECIPIENT_KEY); } catch (e) {}
      recipientId = personById(saved) ? saved : people[0].id;
      renderPeople();
      gate.hidden = true;
      appEl.hidden = false;
      selectRecipient(recipientId);
      S.cleanup(sb, s.user.id);
    });
  }

  sb.auth.getSession().then(function (res) {
    var s = res && res.data && res.data.session;
    if (!s) { location.replace("./"); return; }
    start(s);
  });
  sb.auth.onAuthStateChange(function (event, s) {
    if (event === "SIGNED_OUT") location.replace("./");
    else if (s) session = s;
  });

  // Ne zapuščaj naložene, a neposlane datoteke.
  window.addEventListener("pagehide", function () {
    if (cur && cur.done && !cur.sending) {
      sb.storage.from(S.BUCKET).remove([cur.path]).catch(function () {});
    }
  });
})();

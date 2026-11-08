/* Šeri — stran za pošiljanje datotek (seri.html).
   1) tapni prejemnike (zgoraj; lahko več), 2) tapni velik „+“ in izberi datoteko —
   nalaganje v Supabase Storage se začne takoj, v izvirni obliki,
   3) povleci kartico datoteke gor (ali „Pošlji“) → vrstica v seri_transfers za
   vsakega prejemnika (vsak dobi svojo kopijo datoteke), prejemniki jo v živo
   vidijo na vrhu plošče (inbox.js). */
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
  var galleryBtn = $("seriGallery");
  var galleryInput = $("seriGalleryInput");
  var searchEl = $("seriSearch");
  var searchEmpty = $("seriSearchEmpty");

  if (!window.SUPABASE_URL || !window.supabase) {
    gate.textContent = "Supabase ni nastavljen.";
    return;
  }
  var sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  var session = null;
  var people = [];
  var recipients = [];     // izbrani prejemniki (vrstni red izbire)
  var RECIPIENTS_KEY = "seri-recipients";
  var OLD_RECIPIENT_KEY = "seri-recipient"; // prej en sam prejemnik

  // Trenutni paket: { items: [{ file, path, up (SERI.upload), done, failed, promise, pct }], sending }
  var cur = null;
  var MAX_FILES = 20;
  var filesEl = $("seriFiles");
  var X_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  function plural(n) {
    var m = n % 100;
    return m === 1 ? "datoteka" : m === 2 ? "datoteki" : (m === 3 || m === 4) ? "datoteke" : "datotek";
  }

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
      btn.setAttribute("aria-selected", isPicked(p.id) ? "true" : "false");
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
      btn.addEventListener("click", function () { toggleRecipient(p.id); });
      peopleEl.appendChild(btn);
    });
  }

  function isPicked(id) { return recipients.indexOf(id) !== -1; }

  function saveRecipients() {
    try { localStorage.setItem(RECIPIENTS_KEY, JSON.stringify(recipients)); } catch (e) {}
  }

  // tap = dodaj / odstrani (več prejemnikov hkrati)
  function toggleRecipient(id) {
    if (cur && cur.sending) return;
    if (isPicked(id)) recipients = recipients.filter(function (x) { return x !== id; });
    else recipients.push(id);
    saveRecipients();
    syncPicked();
    if (navigator.vibrate) navigator.vibrate(6);
  }

  function syncPicked() {
    var btns = peopleEl.querySelectorAll(".seri-person");
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute("aria-selected", isPicked(btns[i].getAttribute("data-id")) ? "true" : "false");
    }
    renderTo();
  }

  function shortName(p) { return p.me ? "Jaz" : p.name.split(/\s+/)[0]; }

  function renderTo() {
    var list = recipients.map(personById).filter(Boolean);
    if (!cur || !list.length) {
      toEl.hidden = !cur;
      toEl.textContent = cur ? "Izberi, komu pošlješ — lahko več oseb" : "";
      return;
    }
    toEl.hidden = false;
    toEl.innerHTML = "";
    if (list.length === 1 && list[0].me) {
      toEl.appendChild(document.createTextNode("na tvojo drugo napravo"));
      var s0 = document.createElement("strong");
      s0.textContent = "Jaz";
      toEl.appendChild(s0);
      return;
    }
    toEl.appendChild(document.createTextNode("za"));
    var strong = document.createElement("strong");
    var names = list.map(function (p) { return list.length === 1 ? (p.me ? "Jaz" : p.name) : shortName(p); });
    strong.textContent = names.length <= 3
      ? names.slice(0, -1).join(", ") + (names.length > 1 ? " in " : "") + names[names.length - 1]
      : names.slice(0, 2).join(", ") + " in še " + (names.length - 2);
    toEl.appendChild(strong);
  }

  function pickedButtons() {
    return recipients.map(function (id) {
      return peopleEl.querySelector('.seri-person[data-id="' + id + '"]');
    }).filter(Boolean);
  }

  /* ---------- Izbira datoteke ---------- */

  $("seriPickFile").addEventListener("click", function () { input.click(); });
  // „Galerija“: accept=image/*,video/* → telefon odpre izbirnik fotografij namesto datotek
  galleryBtn.addEventListener("click", function () { galleryInput.click(); });
  $("seriAddMore").addEventListener("click", function () { input.click(); });
  [input, galleryInput].forEach(function (inp) {
    inp.addEventListener("change", function () {
      if (inp.files && inp.files.length) pickFiles(Array.prototype.slice.call(inp.files));
      inp.value = "";
    });
  });

  /* ---------- Iskanje osebe ---------- */
  function norm(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  searchEl.addEventListener("input", filterPeople);
  function filterPeople() {
    var q = norm(searchEl.value.trim());
    var btns = peopleEl.querySelectorAll(".seri-person");
    var shown = 0, first = null;
    for (var i = 0; i < btns.length; i++) {
      var p = personById(btns[i].getAttribute("data-id"));
      var hay = norm((p.me ? "jaz druga naprava " : "") + p.name);
      var ok = !q || q.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
      btns[i].hidden = !ok;
      if (ok) { shown++; if (!first) first = btns[i]; }
    }
    searchEmpty.hidden = shown > 0;
  }
  // Enter = dodaj/odstrani prvi zadetek in počisti iskanje (za naslednjo osebo)
  searchEl.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    var first = peopleEl.querySelector(".seri-person:not([hidden])");
    if (first) toggleRecipient(first.getAttribute("data-id"));
    searchEl.value = "";
    filterPeople();
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
    var fl = e.dataTransfer && e.dataTransfer.files;
    if (fl && fl.length && !appEl.hidden) pickFiles(Array.prototype.slice.call(fl));
  });

  function hideDrop() { dragDepth = 0; dropEl.hidden = true; }
  dropEl.addEventListener("click", hideDrop);
  window.addEventListener("keydown", function (e) { if (e.key === "Escape") hideDrop(); });
  window.addEventListener("dragend", hideDrop);

  // Doda datoteke v paket (prvi izbor odpre kartico, naslednji dodajo).
  function pickFiles(files) {
    if (cur && cur.sending) return;
    var big = files.filter(function (f) { return f.size > S.MAX_BYTES; });
    var ok = files.filter(function (f) { return f.size <= S.MAX_BYTES; });
    if (big.length) {
      toast(big.length === 1
        ? big[0].name + " je prevelika (" + S.formatSize(big[0].size) + "). Največ 50 MB."
        : big.length + " datotek je prevelikih (največ 50 MB na datoteko).");
    }
    if (!ok.length) return;
    var room = MAX_FILES - (cur ? cur.items.length : 0);
    if (ok.length > room) {
      toast("Naenkrat največ " + MAX_FILES + " datotek.");
      ok = ok.slice(0, Math.max(0, room));
      if (!ok.length) return;
    }
    var fresh = !cur;
    if (fresh) cur = { items: [], sending: false };
    ok.forEach(function (file) {
      var it = { file: file, path: session.user.id + "/" + S.uuid(), done: false, failed: false, pct: 0 };
      cur.items.push(it);
      startUpload(cur, it);
    });
    if (fresh) showCard();
    renderFile();
  }

  function showCard() {
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
    // dolgo nalaganje → po 350 ms pokaži vrstico napredka in orbito
    var c = cur;
    setTimeout(function () {
      if (cur === c && !allDone(c)) { progress.hidden = false; card.classList.add("is-uploading"); }
    }, 350);
  }

  function allDone(c) { return c.items.every(function (it) { return it.done; }); }

  function totalPct(c) {
    var total = 0, got = 0;
    c.items.forEach(function (it) { total += it.file.size || 1; got += (it.file.size || 1) * it.pct / 100; });
    return total ? got / total * 100 : 0;
  }

  // kartica: ena datoteka kot prej; več → kup kartic, „N datotek“, skupna velikost, seznam
  function renderFile() {
    var c = cur;
    if (!c) return;
    var n = c.items.length;
    var first = c.items[0].file;
    var colors = S.kindColors(first.name, first.type);
    doc.style.setProperty("--doc-a", colors[0]);
    doc.style.setProperty("--doc-b", colors[1]);
    card.style.setProperty("--doc-a", colors[0]);
    card.style.setProperty("--doc-b", colors[1]);
    card.classList.toggle("is-multi", n > 1);
    if (n === 1) {
      extEl.textContent = (S.ext(first.name) || "file").toUpperCase();
      nameEl.textContent = first.name || "datoteka";
      metaEl.textContent = S.formatSize(first.size);
    } else {
      extEl.textContent = n + "×";
      nameEl.textContent = n + " " + plural(n);
      var sum = c.items.reduce(function (a, it) { return a + it.file.size; }, 0);
      metaEl.textContent = S.formatSize(sum);
    }
    sendBtn.textContent = c.sending ? "Pošiljam …" : (n > 1 ? "Pošlji " + n : "Pošlji");

    filesEl.hidden = n < 2;
    filesEl.innerHTML = "";
    if (n < 2) return;
    c.items.forEach(function (it) {
      var li = document.createElement("li");
      var col = S.kindColors(it.file.name, it.file.type);
      li.style.setProperty("--fa", col[0]);
      li.style.setProperty("--fb", col[1]);
      if (it.done) li.className = "is-done";
      var fx = document.createElement("span");
      fx.className = "seri-fx";
      fx.textContent = (S.ext(it.file.name) || "file").toUpperCase().slice(0, 4);
      var fn = document.createElement("span");
      fn.className = "seri-fn";
      fn.textContent = it.file.name || "datoteka";
      fn.title = (it.file.name || "datoteka") + " · " + S.formatSize(it.file.size);
      var bar = document.createElement("span");
      bar.className = "seri-fbar";
      bar.style.width = it.pct + "%";
      it.barEl = bar;
      li.appendChild(fx);
      li.appendChild(fn);
      li.appendChild(bar);
      if (!c.sending) {
        var x = document.createElement("button");
        x.type = "button";
        x.setAttribute("aria-label", "Odstrani " + (it.file.name || "datoteko"));
        x.innerHTML = X_ICON;
        x.addEventListener("click", function (e) { e.stopPropagation(); removeItem(it); });
        li.appendChild(x);
      }
      it.liEl = li;
      filesEl.appendChild(li);
    });
  }

  function removeItem(it) {
    var c = cur;
    if (!c || c.sending) return;
    c.items = c.items.filter(function (x) { return x !== it; });
    dropItem(it);
    if (!c.items.length) { cur = null; reset(); return; }
    setFill(totalPct(c));
    renderFile();
  }

  function dropItem(it) {
    if (it.up && !it.done) it.up.abort();
    else if (it.done) sb.storage.from(S.BUCKET).remove([it.path]).catch(function () {});
  }

  /* ---------- Nalaganje (XHR zaradi napredka; izvirna datoteka, brez stiskanja) ---------- */

  function setFill(pct) {
    // tekočina: y = 150 (prazno) … -12 (polno, nad robom vala)
    var y = 150 - (pct / 100) * 162;
    liquid.style.transform = "translateY(" + y.toFixed(1) + "px)"; // CSS → gladek prehod
    progressFill.style.width = pct + "%";
    progressPct.textContent = Math.round(pct) + " %";
  }

  function startUpload(c, it) {
    it.up = S.upload(sb, S.BUCKET, it.path, it.file, function (pct) {
      if (cur !== c) return;
      it.pct = pct;
      if (it.barEl) it.barEl.style.width = pct + "%";
      setFill(totalPct(c));
    });
    it.promise = it.up.promise.then(function () {
      it.done = true;
      it.pct = 100;
      if (cur !== c) return;
      if (it.liEl) it.liEl.classList.add("is-done");
      setFill(totalPct(c));
      if (allDone(c)) {
        setTimeout(function () {
          if (cur === c && !c.sending) { progress.hidden = true; card.classList.remove("is-uploading"); }
        }, 500);
      }
    }, function (err) {
      it.failed = true;
      if (err.message !== "abort" && cur === c && !c.sending) {
        toast((c.items.length > 1 ? (it.file.name + ": ") : "") + err.message);
        removeItem(it);
      }
      throw err;
    });
    it.promise.catch(function () {});
  }

  /* ---------- Pošiljanje ---------- */

  sendBtn.addEventListener("click", function () { send(); });
  cancelBtn.addEventListener("click", function () { discard(); reset(); });

  function send() {
    var c = cur;
    if (!c || c.sending) return;
    var to = recipients.filter(personById);
    if (!to.length) { toast("Izberi, komu pošlješ — lahko več oseb."); springBack(); return; }
    c.sending = true;
    sendBtn.disabled = true;
    renderFile(); // brez ✕ med pošiljanjem

    if (!allDone(c)) {
      // Nalaganje še teče: kartica počaka na sredini z napredkom.
      springBack();
      progress.hidden = false;
      card.classList.add("is-uploading");
    }

    // Vsaka datoteka je naložena enkrat (it.path, za prvega prejemnika); za vsakega
    // naslednjega naredi kopijo na strežniku (brez ponovnega nalaganja), da lahko
    // vsak prejemnik svojo pobriše, ne da bi jo drugim.
    var copies = [];
    Promise.all(c.items.map(function (it) { return it.promise; }))
      .then(function () {
        var jobs = [];
        c.items.forEach(function (it) {
          it.paths = [it.path];
          to.slice(1).forEach(function () {
            var p = session.user.id + "/" + S.uuid();
            it.paths.push(p);
            copies.push(p);
            jobs.push(sb.storage.from(S.BUCKET).copy(it.path, p).then(function (r) {
              if (r.error) throw new Error("Kopiranje za prejemnika ni uspelo.");
            }));
          });
        });
        return Promise.all(jobs);
      })
      .then(function () {
        var rows = [];
        c.items.forEach(function (it) {
          to.forEach(function (id, i) {
            rows.push({
              recipient_id: id,
              path: it.paths[i],
              name: it.file.name || "datoteka",
              size: it.file.size,
              mime: it.file.type || null
            });
          });
        });
        return sb.from("seri_transfers").insert(rows);
      })
      .then(function (res) {
        if (res && res.error) throw new Error("Pošiljanje ni uspelo.");
        if (cur !== c) return;
        flyTo(to);
      })
      .catch(function (err) {
        // pobriši morebitne že narejene kopije (vrstice niso bile vstavljene)
        if (copies.length) sb.storage.from(S.BUCKET).remove(copies).catch(function () {});
        if (cur !== c) return;
        c.sending = false;
        sendBtn.disabled = false;
        // neuspešno naložene odstrani, ostale ostanejo za ponoven poskus
        var failed = c.items.filter(function (it) { return it.failed; });
        c.items = c.items.filter(function (it) { return !it.failed; });
        if (!c.items.length) { cur = null; reset(); }
        else renderFile();
        if (failed.length) toast(failed.length === 1 ? failed[0].file.name + " se ni naložila." : failed.length + " datotek se ni naložilo.");
        else if (err && err.message && err.message !== "abort") toast(err.message);
        if (cur) springBack();
      });
  }

  // Ikona razpade v delce, ki odletijo v avatar prejemnika; prejemnik isto
  // animacijo (enako dolgo) predvaja v obratni smeri — glej SERI.transfer.
  var beam = null;
  function flyTo(ids) {
    var c = cur;
    var avatars = function () {
      return ids.map(function (id) {
        return peopleEl.querySelector('.seri-person[data-id="' + id + '"] .seri-avatar');
      }).filter(Boolean);
    };
    var svg = doc.querySelector("svg");
    swipeHint.hidden = true;
    clearTarget();
    card.classList.remove("is-dragging", "is-uploading");
    card.classList.add("is-returning", "is-beaming");
    fileWrap.classList.add("is-beaming");
    card.style.transform = "";
    progress.hidden = false;
    setBar(0);
    avatars().forEach(function (a) { a.parentNode.classList.add("is-target"); });

    beam = S.transfer({
      icon: S.makeIcon(c.items[0].file.name, c.items[0].file.type),
      mode: "out",
      rect: function () { return cur === c ? svg.getBoundingClientRect() : null; },
      // delci se razdelijo med vse izbrane avatarje
      points: function () {
        var list = avatars().map(function (a) {
          var r = a.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        return list.length ? list : [{ x: innerWidth / 2, y: -40 }];
      },
      onProgress: function (k) { setBar(k * 100); },
      onDone: function () {
        beam = null;
        if (cur !== c) return;
        var ca = card.style.getPropertyValue("--doc-a"), cb = card.style.getPropertyValue("--doc-b");
        avatars().forEach(function (a) {
          var b = a.parentNode;
          b.classList.remove("is-target");
          b.classList.add("is-hit");
          var check = document.createElement("span");
          check.className = "seri-person-check";
          check.innerHTML = CHECK_ICON;
          a.appendChild(check);
          setTimeout(function () { b.classList.remove("is-hit"); check.remove(); }, 1600);
          var r = a.getBoundingClientRect();
          burst(r.left + r.width / 2, r.top + r.height / 2, ca, cb);
        });
        var list = ids.map(personById).filter(Boolean);
        var n = c.items.length;
        var what = n > 1 ? n + " " + plural(n) + " " : "";
        if (list.length === 1) {
          toast(list[0].me ? "Poslano " + what + "na tvojo drugo napravo ✓" : "Poslano " + what + "→ " + list[0].name + " ✓");
        } else {
          toast("Poslano " + what + list.length + (list.length === 2 ? " osebama" : " osebam") + " ✓");
        }
        cur = null;
        reset();
      }
    });
  }

  // samo vrstica napredka (brez tekočine v ikoni)
  function setBar(pct) {
    progressFill.style.width = pct + "%";
    progressPct.textContent = Math.round(pct) + " %";
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
    if (!c.sending) c.items.forEach(dropItem);
  }

  function reset() {
    cur = null;
    if (beam) { beam.cancel(); beam = null; }
    fileWrap.classList.remove("is-beaming");
    fileWrap.hidden = true;
    filesEl.hidden = true;
    filesEl.innerHTML = "";
    card.classList.remove("is-multi");
    plusBtn.hidden = false;
    plusHint.hidden = false;
    toEl.hidden = true;
    card.classList.remove("is-uploading", "is-flying", "is-returning", "is-dragging", "is-beaming");
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
    var t = peopleEl.querySelectorAll(".seri-person.is-target");
    for (var i = 0; i < t.length; i++) t[i].classList.remove("is-target");
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
    pickedButtons().forEach(function (btn) { btn.classList.toggle("is-target", k >= 1); });
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
      // zapomnjena izbira (prej en sam prejemnik pod starim ključem)
      var saved = [];
      try {
        saved = JSON.parse(localStorage.getItem(RECIPIENTS_KEY) || "null") ||
          [localStorage.getItem(OLD_RECIPIENT_KEY)];
      } catch (e) {}
      recipients = (Array.isArray(saved) ? saved : []).filter(function (id) { return id && personById(id); });
      if (!recipients.length) recipients = [people[0].id];
      renderPeople();
      gate.hidden = true;
      appEl.hidden = false;
      syncPicked();
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
    if (cur && !cur.sending) {
      var done = cur.items.filter(function (it) { return it.done; }).map(function (it) { return it.path; });
      if (done.length) sb.storage.from(S.BUCKET).remove(done).catch(function () {});
    }
  });
})();

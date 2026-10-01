/* TomStudios — stran Administracija (admin.html, samo za admine).
   Uporabniki: pravice do aplikacij, ime in priimek, geslo, blokiranje, admin.
   Vabila: nova enkratna povezava, seznam, preklic.
   Vse gre prek admin_* funkcij v bazi (supabase/005_admin.sql), ki same
   preverijo, ali je klicatelj admin — preverjanje na tej strani je samo
   udobje (prijazno sporočilo), ne zaščita. Seja je ista kot na plošči
   (isti izvor in Supabase projekt), zato tu ni lastne prijave. */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  var gate = $("adminGate");
  var app = $("adminApp");
  var count = $("adminCount");
  var tabUsers = $("adminTabUsers");
  var tabInvites = $("adminTabInvites");
  var usersSection = $("adminUsers");
  var invitesSection = $("adminInvites");
  var search = $("adminSearch");
  var usersStatus = $("adminUsersStatus");
  var userList = $("adminUserList");
  var inviteForm = $("adminInviteForm");
  var inviteNote = $("adminInviteNote");
  var invitesStatus = $("adminInvitesStatus");
  var inviteList = $("adminInviteList");

  var APPS = window.PTOMSETU_APPS || [];
  var INVITE_BASE = "https://zig4to.github.io/TomsStudios/?vabilo=";
  var users = [];

  /* ---------- Pomožno ---------- */

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function button(text, cls, onClick) {
    var b = el("button", "admin-btn" + (cls ? " " + cls : ""), text);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  function fmtDate(ts) {
    if (!ts) return "nikoli";
    return new Date(ts).toLocaleString("sl-SI", {
      day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  function errorText(err) {
    var m = (err && err.message) || String(err || "");
    if (/not_admin/.test(m)) return "Nimaš administratorskih pravic.";
    if (/cannot_block_self/.test(m)) return "Samega sebe ne moreš blokirati.";
    if (/cannot_unadmin_self/.test(m)) return "Sebi ne moreš odvzeti admina.";
    if (/password_too_short/.test(m)) return "Geslo mora imeti vsaj 6 znakov.";
    if (/Could not find the function|PGRST202/.test(m)) return "Administracija v bazi še ni nastavljena (supabase/005_admin.sql).";
    return "Napaka: " + m;
  }

  // Klic admin funkcije: med klicem onemogoči gumb, napako pokaže v statusu.
  function call(fn, args, statusEl, btn) {
    if (btn) btn.disabled = true;
    return window.sb.rpc(fn, args).then(function (res) {
      if (btn) btn.disabled = false;
      if (res.error) {
        statusEl.textContent = errorText(res.error);
        throw res.error;
      }
      return res.data;
    }, function (err) {
      if (btn) btn.disabled = false;
      statusEl.textContent = "Napaka pri povezavi. Poskusi znova.";
      throw err;
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    }
    return Promise.resolve(false);
  }

  /* ---------- Vstop: prijava + admin ---------- */

  function showGate(text, withLink) {
    gate.textContent = text;
    if (withLink) {
      gate.appendChild(document.createElement("br"));
      var a = el("a", "admin-gate-link", "Nazaj na ploščo");
      a.href = "./";
      gate.appendChild(a);
    }
    gate.hidden = false;
    app.hidden = true;
  }

  if (!window.SUPABASE_URL || !window.supabase) {
    showGate("Supabase ni nastavljen.", true);
    return;
  }
  window.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

  window.sb.auth.getSession().then(function (res) {
    var session = res.data && res.data.session;
    if (!session) {
      // Prijava je na plošči; po njej se lahko vrneš sem.
      location.replace("./");
      return;
    }
    window.PTOMSETU_USER = session.user;
    return window.sb.rpc("my_access").then(function (r) {
      var a = r.data;
      if (r.error || !a || !a.is_admin || a.blocked) {
        showGate("Nimaš administratorskih pravic.", true);
        return;
      }
      gate.hidden = true;
      app.hidden = false;
      setTab(location.hash === "#vabila" ? "invites" : "users");
      loadUsers();
    });
  }).catch(function () {
    showGate("Nalaganje ni uspelo. Preveri povezavo in osveži stran.", true);
  });

  window.sb.auth.onAuthStateChange(function (event) {
    if (event === "SIGNED_OUT") location.replace("./");
  });

  function setTab(which) {
    var isUsers = which === "users";
    tabUsers.setAttribute("aria-selected", String(isUsers));
    tabInvites.setAttribute("aria-selected", String(!isUsers));
    usersSection.hidden = !isUsers;
    invitesSection.hidden = isUsers;
    history.replaceState(null, "", location.pathname + (isUsers ? "" : "#vabila"));
    if (!isUsers) loadInvites();
  }
  tabUsers.addEventListener("click", function () { setTab("users"); });
  tabInvites.addEventListener("click", function () { setTab("invites"); });

  /* ---------- Uporabniki ---------- */

  function loadUsers() {
    usersStatus.textContent = "Nalagam …";
    call("admin_list_users", {}, usersStatus).then(function (data) {
      users = data || [];
      usersStatus.textContent = "";
      renderUsers();
    }, function () {});
  }

  if (search) search.addEventListener("input", renderUsers);

  function fullName(u) {
    return ((u.first_name || "") + " " + (u.last_name || "")).trim();
  }

  function renderUsers() {
    var q = (search && search.value || "").trim().toLowerCase();
    userList.innerHTML = "";
    var shown = users.filter(function (u) {
      return !q || (fullName(u) + " " + u.email).toLowerCase().indexOf(q) !== -1;
    });
    if (count) {
      count.textContent = q
        ? shown.length + " od " + users.length
        : users.length + (users.length === 1 ? " uporabnik" : users.length === 2 ? " uporabnika" : users.length < 5 ? " uporabniki" : " uporabnikov");
    }
    if (!shown.length) {
      userList.appendChild(el("p", "admin-empty", users.length ? "Ni zadetkov." : "Ni uporabnikov."));
      return;
    }
    shown.forEach(function (u) { userList.appendChild(buildUser(u)); });
  }

  function buildUser(u) {
    var me = window.PTOMSETU_USER && window.PTOMSETU_USER.id === u.id;
    var card = el("div", "admin-user" + (u.blocked ? " is-blocked" : ""));

    var head = el("div", "admin-user-head");
    var who = el("div", "admin-user-who");
    var name = fullName(u);
    who.appendChild(el("span", "admin-user-name" + (name ? "" : " is-muted"), name || "Brez imena"));
    who.appendChild(el("span", "admin-user-email", u.email));
    head.appendChild(who);
    var badges = el("div", "admin-badges");
    if (me) badges.appendChild(el("span", "admin-badge", "To si ti"));
    if (u.is_admin) badges.appendChild(el("span", "admin-badge admin-badge--admin", "Admin"));
    if (u.blocked) badges.appendChild(el("span", "admin-badge admin-badge--blocked", "Blokiran"));
    if (!u.confirmed) badges.appendChild(el("span", "admin-badge", "E-pošta ni potrjena"));
    head.appendChild(badges);
    card.appendChild(head);

    card.appendChild(el("p", "admin-user-meta",
      "Registriran " + fmtDate(u.created_at) + " · Zadnja prijava " + fmtDate(u.last_sign_in_at)));

    var status = el("p", "admin-status");

    // Pravice do aplikacij
    var apps = el("div", "admin-apps");
    if (u.is_admin) {
      apps.appendChild(el("p", "admin-note", "Admin ima dostop do vseh aplikacij."));
    } else {
      APPS.forEach(function (app) {
        var has = (u.apps || []).indexOf(app.id) !== -1;
        var chip = el("button", "admin-app-chip", app.title);
        chip.type = "button";
        chip.setAttribute("aria-pressed", String(has));
        chip.style.setProperty("--accent", app.accent);
        chip.addEventListener("click", function () {
          var now = chip.getAttribute("aria-pressed") !== "true";
          status.textContent = "";
          call("admin_set_app_access", { p_user: u.id, p_app: app.id, p_allowed: now }, status, chip).then(function () {
            chip.setAttribute("aria-pressed", String(now));
            u.apps = (u.apps || []).filter(function (x) { return x !== app.id; });
            if (now) u.apps.push(app.id);
          }, function () {});
        });
        apps.appendChild(chip);
      });
    }
    card.appendChild(apps);

    // Dejanja
    var inline = el("div", "admin-inline");
    var actions = el("div", "admin-actions");

    actions.appendChild(button("Uredi ime", "", function () {
      showNameForm(u, inline, status);
    }));
    actions.appendChild(button("Nastavi geslo", "", function () {
      showPasswordForm(u, inline, status);
    }));

    var blockBtn = button(u.blocked ? "Odblokiraj" : "Blokiraj", u.blocked ? "" : "admin-btn--danger", function () {
      var to = !u.blocked;
      if (to && !confirm("Blokiram " + (name || u.email) + "? Ne bo imel/a dostopa do nobene aplikacije.")) return;
      call("admin_set_blocked", { p_user: u.id, p_blocked: to }, status, blockBtn).then(function () {
        u.blocked = to;
        card.replaceWith(buildUser(u));
      }, function () {});
    });
    blockBtn.disabled = me;
    actions.appendChild(blockBtn);

    var adminBtn = button(u.is_admin ? "Odvzemi admina" : "Naredi admina", "", function () {
      var to = !u.is_admin;
      if (to && !confirm((name || u.email) + " bo lahko urejal/a vse uporabnike in vabila. Nadaljujem?")) return;
      call("admin_set_admin", { p_user: u.id, p_admin: to }, status, adminBtn).then(function () {
        u.is_admin = to;
        card.replaceWith(buildUser(u));
      }, function () {});
    });
    adminBtn.disabled = me && u.is_admin;
    actions.appendChild(adminBtn);

    card.appendChild(actions);
    card.appendChild(inline);
    card.appendChild(status);
    return card;
  }

  function showNameForm(u, inline, status) {
    inline.innerHTML = "";
    status.textContent = "";
    var form = el("form", "admin-inline-form");
    var first = el("input"); first.type = "text"; first.placeholder = "Ime"; first.value = u.first_name || "";
    var last = el("input"); last.type = "text"; last.placeholder = "Priimek"; last.value = u.last_name || "";
    var save = el("button", "admin-btn admin-btn--primary", "Shrani"); save.type = "submit";
    form.appendChild(first);
    form.appendChild(last);
    form.appendChild(save);
    form.appendChild(button("Prekliči", "", function () { inline.innerHTML = ""; }));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = first.value.trim(), l = last.value.trim();
      if (!f || !l) { status.textContent = "Vpiši ime in priimek."; return; }
      call("admin_set_name", { p_user: u.id, p_first: f, p_last: l }, status, save).then(function () {
        u.first_name = f;
        u.last_name = l;
        var card = inline.closest(".admin-user");
        if (card) card.replaceWith(buildUser(u));
      }, function () {});
    });
    inline.appendChild(form);
    first.focus();
  }

  function showPasswordForm(u, inline, status) {
    inline.innerHTML = "";
    status.textContent = "";
    var form = el("form", "admin-inline-form");
    var pass = el("input"); pass.type = "text"; pass.placeholder = "Novo geslo (najmanj 6 znakov)";
    pass.autocomplete = "off"; pass.minLength = 6;
    var save = el("button", "admin-btn admin-btn--primary", "Nastavi"); save.type = "submit";
    form.appendChild(pass);
    form.appendChild(save);
    form.appendChild(button("Prekliči", "", function () { inline.innerHTML = ""; }));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (pass.value.length < 6) { status.textContent = "Geslo mora imeti vsaj 6 znakov."; return; }
      call("admin_set_password", { p_user: u.id, p_password: pass.value }, status, save).then(function () {
        inline.innerHTML = "";
        status.textContent = "Geslo je nastavljeno. Sporoči ga uporabniku; spremeni ga lahko s »Pozabljeno geslo?«.";
      }, function () {});
    });
    inline.appendChild(form);
    pass.focus();
  }

  /* ---------- Vabila ---------- */

  function loadInvites() {
    invitesStatus.textContent = "Nalagam …";
    call("admin_list_invites", {}, invitesStatus).then(function (data) {
      invitesStatus.textContent = "";
      renderInvites(data || []);
    }, function () {});
  }

  function shareOrCopy(link, statusEl) {
    copyText(link).then(function (ok) {
      statusEl.textContent = ok ? "Povezava je kopirana: " + link : "Kopiraj povezavo: " + link;
    });
  }

  function renderInvites(list) {
    inviteList.innerHTML = "";
    if (!list.length) {
      inviteList.appendChild(el("p", "admin-empty", "Še ni vabil."));
      return;
    }
    list.forEach(function (inv) {
      var link = INVITE_BASE + inv.code;
      var row = el("div", "admin-invite" + (inv.used_at ? " is-used" : ""));
      var info = el("div", "admin-invite-info");
      info.appendChild(el("span", "admin-user-name", inv.note || "Brez opisa"));
      info.appendChild(el("span", "admin-user-meta", inv.used_at
        ? "Porabil/a " + (inv.used_by || "?") + " · " + fmtDate(inv.used_at)
        : "Neporabljeno · ustvarjeno " + fmtDate(inv.created_at)));
      row.appendChild(info);
      if (!inv.used_at) {
        var acts = el("div", "admin-actions");
        acts.appendChild(button("Kopiraj", "", function () { shareOrCopy(link, invitesStatus); }));
        if (navigator.share) {
          acts.appendChild(button("Deli", "", function () {
            navigator.share({ title: "Vabilo v TomStudios", text: "Vabilo v TomStudios", url: link }).catch(function () {});
          }));
        }
        var del = button("Prekliči", "admin-btn--danger", function () {
          if (!confirm("Prekličem vabilo za " + (inv.note || "ta naslov") + "? Povezava ne bo več delovala.")) return;
          call("admin_delete_invite", { p_code: inv.code }, invitesStatus, del).then(loadInvites, function () {});
        });
        acts.appendChild(del);
        row.appendChild(acts);
      }
      inviteList.appendChild(row);
    });
  }

  inviteForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var note = inviteNote.value.trim();
    if (!note) return;
    var btn = inviteForm.querySelector("button[type=submit]");
    invitesStatus.textContent = "";
    call("admin_new_invite", { p_note: note }, invitesStatus, btn).then(function (link) {
      inviteNote.value = "";
      shareOrCopy(link, invitesStatus);
      call("admin_list_invites", {}, invitesStatus).then(function (data) { renderInvites(data || []); }, function () {});
    }, function () {});
  });
})();

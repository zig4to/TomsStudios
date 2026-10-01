/* TomStudios — prijava, registracija, odjava, preverjanje seje.
   Sproža dogodka "ptomsetu:signed-in" (detail.session) in "ptomsetu:signed-out"
   na document, na katera posluša dashboard.js. Ne uvaža dashboard.js in ne ve
   zanj — samo skrbi za sejo in preklop med zaslonoma. */
(function () {
  "use strict";

  var loadingScreen = document.getElementById("loadingScreen");
  var authScreen = document.getElementById("authScreen");
  var appShell = document.getElementById("appShell");
  var authForms = document.getElementById("authForms");
  var authNotConfigured = document.getElementById("authNotConfigured");

  function showLoading() {
    if (loadingScreen) loadingScreen.hidden = false;
    if (authScreen) authScreen.hidden = true;
    if (appShell) appShell.hidden = true;
  }
  function showAuth() {
    if (loadingScreen) loadingScreen.hidden = true;
    if (authScreen) authScreen.hidden = false;
    if (appShell) appShell.hidden = true;
  }
  function showApp() {
    if (loadingScreen) loadingScreen.hidden = true;
    if (authScreen) authScreen.hidden = true;
    if (appShell) appShell.hidden = false;
  }

  var CONFIGURED = !!(
    window.SUPABASE_URL &&
    window.SUPABASE_ANON_KEY &&
    window.SUPABASE_URL.indexOf("YOUR-") === -1 &&
    window.SUPABASE_ANON_KEY.indexOf("YOUR-") === -1
  );

  if (!CONFIGURED) {
    showAuth();
    if (authForms) authForms.hidden = true;
    if (authNotConfigured) authNotConfigured.hidden = false;
    return;
  }

  // Povezava za ponastavitev gesla iz e-pošte pripelje nazaj sem z
  // "#...type=recovery" v naslovu. Preberemo ga PRED createClient, ker ga
  // supabase-js po obdelavi pobriše iz naslova. Dokler je recoveryMode
  // vklopljen, uporabnika ne spustimo na ploščo, ampak mu pokažemo obrazec
  // za novo geslo (seja iz povezave je sicer že veljavna prijava).
  var recoveryMode = /type=recovery/.test(location.hash);

  // Koda vabila iz povezave ?vabilo=<koda> (glej supabase/004_invite_codes.sql).
  // Shranimo jo, ker jo iz naslova takoj odstranimo — da ne obtiči v
  // zaznamkih ali nameščeni aplikaciji — uporabnik pa se lahko registrira
  // šele čez nekaj trenutkov. Pošlje se ob registraciji v user_metadata.
  var INVITE_KEY = "ptomsetu-invite";
  var invite = null;
  try {
    var params = new URLSearchParams(location.search);
    invite = params.get("vabilo");
    if (invite) {
      localStorage.setItem(INVITE_KEY, invite);
      params.delete("vabilo");
      var qs = params.toString();
      history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
    } else {
      invite = localStorage.getItem(INVITE_KEY);
    }
  } catch (e) {}

  var sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  window.sb = sb;
  window.PTOMSETU_USER = null;

  /* ---------- Zavihka Prijava / Registracija (+ pozabljeno / novo geslo) ---------- */

  var authTabs = document.querySelector(".auth-tabs");
  var tabLogin = document.getElementById("tabLogin");
  var tabRegister = document.getElementById("tabRegister");
  var loginForm = document.getElementById("loginForm");
  var registerForm = document.getElementById("registerForm");
  var forgotForm = document.getElementById("forgotForm");
  var newPasswordForm = document.getElementById("newPasswordForm");
  var forgotPasswordLink = document.getElementById("forgotPasswordLink");
  var forgotBackLink = document.getElementById("forgotBackLink");

  // which: "login" | "register" | "forgot" | "newPassword". Zadnja dva nista
  // zavihka — takrat sta gumba Prijava/Registracija skrita.
  function setTab(which) {
    var isLogin = which === "login";
    var isRegister = which === "register";
    if (authTabs) authTabs.hidden = !(isLogin || isRegister);
    if (tabLogin) tabLogin.setAttribute("aria-selected", String(isLogin));
    if (tabRegister) tabRegister.setAttribute("aria-selected", String(isRegister));
    if (loginForm) loginForm.hidden = !isLogin;
    if (registerForm) registerForm.hidden = !isRegister;
    if (forgotForm) forgotForm.hidden = which !== "forgot";
    if (newPasswordForm) newPasswordForm.hidden = which !== "newPassword";
  }
  var registerHint = document.getElementById("registerHint");
  if (registerHint && invite) registerHint.textContent = "Registriraš se s povabilom.";

  if (tabLogin) tabLogin.addEventListener("click", function () { setTab("login"); });
  if (tabRegister) tabRegister.addEventListener("click", function () { setTab("register"); });
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", function () {
      // Prenesi že vpisano e-pošto, da je ni treba tipkati še enkrat.
      var typed = loginForm.querySelector('input[type="email"]').value.trim();
      var forgotEmail = forgotForm.querySelector('input[type="email"]');
      if (typed && !forgotEmail.value) forgotEmail.value = typed;
      showFormMessage(forgotForm, "", true);
      setTab("forgot");
    });
  }
  if (forgotBackLink) forgotBackLink.addEventListener("click", function () { setTab("login"); });

  function showFormMessage(form, text, isError) {
    var el = form.querySelector(".auth-error");
    if (!el) return;
    el.textContent = text || "";
    el.hidden = !text;
    el.classList.toggle("auth-error--info", !isError && !!text);
  }

  function friendlyLoginError(err) {
    var msg = (err && err.message) || "";
    if (/invalid login credentials/i.test(msg)) return "Napačna e-pošta ali geslo.";
    if (/email not confirmed/i.test(msg)) return "Najprej potrdi e-pošto (povezava v e-poštnem sporočilu).";
    return "Prijava ni uspela. Poskusi znova.";
  }

  function friendlySignupError(err) {
    var msg = (err && err.message) || "";
    if (/signup_not_allowed/i.test(msg) || /database error saving new user/i.test(msg)) {
      return invite
        ? "Povezava z vabilom ni več veljavna. Prosi za novo."
        : "Za registracijo potrebuješ povezavo z vabilom.";
    }
    if (/already registered/i.test(msg) || /user already exists/i.test(msg)) {
      return "Ta e-poštni naslov je že registriran. Poskusi se prijaviti.";
    }
    return "Registracija ni uspela. Preveri podatke in poskusi znova.";
  }

  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      showFormMessage(loginForm, "", true);
      var email = loginForm.querySelector('input[type="email"]').value.trim();
      var password = loginForm.querySelector(".auth-password").value;
      var btn = loginForm.querySelector(".auth-submit");
      if (btn) btn.disabled = true;
      sb.auth
        .signInWithPassword({ email: email, password: password })
        .then(function (res) {
          if (res.error) showFormMessage(loginForm, friendlyLoginError(res.error), true);
        })
        .catch(function () { showFormMessage(loginForm, "Prijava ni uspela. Poskusi znova.", true); })
        .then(function () { if (btn) btn.disabled = false; });
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", function (e) {
      e.preventDefault();
      showFormMessage(registerForm, "", true);
      var nameInputs = registerForm.querySelectorAll('input[type="text"]');
      var firstName = nameInputs[0] ? nameInputs[0].value.trim() : "";
      var lastName = nameInputs[1] ? nameInputs[1].value.trim() : "";
      var email = registerForm.querySelector('input[type="email"]').value.trim();
      var password = registerForm.querySelector(".auth-password").value;
      var btn = registerForm.querySelector(".auth-submit");
      if (btn) btn.disabled = true;
      // emailRedirectTo: potrditvena povezava v e-pošti pripelje nazaj sem —
      // na isto stran/izvor, s katerega se je nekdo registriral (lokalno v
      // razvoju ali na dejanski objavljeni domeni), namesto na privzeti
      // "Site URL" iz Supabase nastavitev. Ta naslov mora biti vnaprej dodan
      // v Supabase: Authentication → URL Configuration → Redirect URLs.
      // options.data se shrani v user_metadata — od tod dashboard.js in
      // krog z začetnicami dobita ime in priimek.
      sb.auth
        .signUp({
          email: email,
          password: password,
          options: {
            emailRedirectTo: location.origin + location.pathname,
            data: invite
              ? { first_name: firstName, last_name: lastName, invite: invite }
              : { first_name: firstName, last_name: lastName }
          }
        })
        .then(function (res) {
          if (res.error) {
            showFormMessage(registerForm, friendlySignupError(res.error), true);
          } else if (res.data && res.data.user && !res.data.session) {
            showFormMessage(registerForm, "Račun je ustvarjen. Preveri e-pošto in potrdi račun, nato se prijavi.", false);
          }
          if (!res.error) {
            try { localStorage.removeItem(INVITE_KEY); } catch (e) {}
          }
        })
        .catch(function () { showFormMessage(registerForm, "Registracija ni uspela. Poskusi znova.", true); })
        .then(function () { if (btn) btn.disabled = false; });
    });
  }

  /* ---------- Pozabljeno geslo ---------- */

  if (forgotForm) {
    forgotForm.addEventListener("submit", function (e) {
      e.preventDefault();
      showFormMessage(forgotForm, "", true);
      var email = forgotForm.querySelector('input[type="email"]').value.trim();
      var btn = forgotForm.querySelector(".auth-submit");
      if (btn) btn.disabled = true;
      // redirectTo: tako kot pri registraciji mora biti ta naslov dodan v
      // Supabase: Authentication → URL Configuration → Redirect URLs.
      sb.auth
        .resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })
        .then(function (res) {
          if (res.error && /rate limit|too many|for security purposes/i.test(res.error.message || "")) {
            showFormMessage(forgotForm, "Preveč poskusov. Počakaj minuto in poskusi znova.", true);
          } else if (res.error) {
            showFormMessage(forgotForm, "Pošiljanje ni uspelo. Poskusi znova.", true);
          } else {
            // Namenoma enako sporočilo ne glede na to, ali račun obstaja.
            showFormMessage(forgotForm, "Če račun s tem naslovom obstaja, smo ti poslali e-pošto s povezavo za novo geslo.", false);
          }
        })
        .catch(function () { showFormMessage(forgotForm, "Pošiljanje ni uspelo. Poskusi znova.", true); })
        .then(function () { if (btn) btn.disabled = false; });
    });
  }

  if (newPasswordForm) {
    newPasswordForm.addEventListener("submit", function (e) {
      e.preventDefault();
      showFormMessage(newPasswordForm, "", true);
      var password = newPasswordForm.querySelector(".auth-password").value;
      var btn = newPasswordForm.querySelector(".auth-submit");
      if (btn) btn.disabled = true;
      sb.auth
        .updateUser({ password: password })
        .then(function (res) {
          if (res.error) {
            var msg = res.error.message || "";
            var text = /different from the old/i.test(msg)
              ? "Novo geslo mora biti drugačno od starega."
              : /session|jwt|expired/i.test(msg)
                ? "Povezava je potekla. Zahtevaj novo povezavo za ponastavitev gesla."
                : "Shranjevanje gesla ni uspelo. Poskusi znova.";
            showFormMessage(newPasswordForm, text, true);
            return;
          }
          recoveryMode = false;
          newPasswordForm.reset();
          return sb.auth.getSession().then(function (r) { onSession(r.data && r.data.session); });
        })
        .catch(function () { showFormMessage(newPasswordForm, "Shranjevanje gesla ni uspelo. Poskusi znova.", true); })
        .then(function () { if (btn) btn.disabled = false; });
    });
  }

  /* ---------- Prikaži/skrij geslo (ikona "oko") ---------- */

  var passwordToggles = document.querySelectorAll(".password-toggle");
  for (var pt = 0; pt < passwordToggles.length; pt++) {
    (function (btn) {
      var input = btn.parentElement.querySelector(".auth-password");
      var eyeIcon = btn.querySelector(".icon-eye");
      var eyeOffIcon = btn.querySelector(".icon-eye-off");
      btn.addEventListener("click", function () {
        var showing = input.type === "text";
        input.type = showing ? "password" : "text";
        btn.setAttribute("aria-pressed", String(!showing));
        btn.setAttribute("aria-label", showing ? "Pokaži geslo" : "Skrij geslo");
        if (eyeIcon) {
          if (showing) eyeIcon.removeAttribute("hidden");
          else eyeIcon.setAttribute("hidden", "");
        }
        if (eyeOffIcon) {
          if (showing) eyeOffIcon.setAttribute("hidden", "");
          else eyeOffIcon.removeAttribute("hidden");
        }
      });
    })(passwordToggles[pt]);
  }

  /* ---------- Odjava (gumb v pojavnem oknu kroga) ---------- */

  var avatarLogoutBtn = document.getElementById("avatarLogoutBtn");
  if (avatarLogoutBtn) {
    avatarLogoutBtn.addEventListener("click", function () { sb.auth.signOut(); });
  }

  /* ---------- Krog z začetnicami (kdo je prijavljen) ---------- */

  var userAvatarBtn = document.getElementById("userAvatarBtn");
  var userAvatarInitials = document.getElementById("userAvatarInitials");
  var userAvatarPopover = document.getElementById("userAvatarPopover");
  var userAvatarName = document.getElementById("userAvatarName");
  var userAvatarEmail = document.getElementById("userAvatarEmail");
  var userNameForm = document.getElementById("userNameForm");
  var userFirstName = document.getElementById("userFirstName");
  var userLastName = document.getElementById("userLastName");
  var userNameFormMsg = document.getElementById("userNameFormMsg");

  // Ime uporabnika iz user_metadata v različnih oblikah: first_name/last_name
  // (kar shrani registracijski obrazec), sicer given_name/family_name ali
  // enotni full_name/name/display_name (npr. iz drugih aplikacij ali OAuth).
  function fullNameFor(user) {
    var meta = (user && user.user_metadata) || {};
    var first = String(meta.first_name || meta.given_name || "").trim();
    var last = String(meta.last_name || meta.family_name || "").trim();
    var full = (first + " " + last).trim();
    if (!full) {
      full = String(meta.full_name || meta.name || meta.display_name || "").trim();
    }
    return full;
  }

  // Prazen niz, če ni shranjenega pravega imena (star račun) — takrat se v
  // pojavnem oknu prikaže samo e-pošta, ne podvojeno še enkrat kot "ime".
  function displayNameFor(user) {
    return fullNameFor(user);
  }

  function initialsFor(user) {
    var full = fullNameFor(user);
    if (full) {
      var words = full.split(/\s+/).filter(Boolean);
      var a = words[0] ? words[0].charAt(0) : "";
      var b = words.length > 1 ? words[words.length - 1].charAt(0) : "";
      var ini = (a + b).toUpperCase();
      if (ini) return ini;
    }
    // Star račun brez shranjenega imena — začetnici iz e-pošte kot nadomestilo.
    var email = (user && user.email) || "";
    return email.slice(0, 2).toUpperCase() || "?";
  }

  // Napolni krog z začetnicami + ime/e-pošto v pojavnem oknu. Če uporabnik nima
  // shranjenega imena, pokaže obrazec za vpis imena in priimka.
  function applyUser(user) {
    if (userAvatarInitials) userAvatarInitials.textContent = initialsFor(user);
    var fullName = displayNameFor(user);
    if (userAvatarName) {
      userAvatarName.textContent = fullName;
      userAvatarName.hidden = !fullName;
    }
    if (userAvatarEmail) userAvatarEmail.textContent = (user && user.email) || "";
    if (userNameForm) userNameForm.hidden = !!fullName;
  }

  if (userNameForm) {
    userNameForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var first = (userFirstName && userFirstName.value || "").trim();
      var last = (userLastName && userLastName.value || "").trim();
      if (userNameFormMsg) userNameFormMsg.textContent = "";
      if (!first || !last) {
        if (userNameFormMsg) userNameFormMsg.textContent = "Vpiši ime in priimek.";
        return;
      }
      var saveBtn = userNameForm.querySelector("button[type=submit]");
      if (saveBtn) saveBtn.disabled = true;
      sb.auth.updateUser({ data: { first_name: first, last_name: last } })
        .then(function (res) {
          if (saveBtn) saveBtn.disabled = false;
          if (res.error) {
            if (userNameFormMsg) userNameFormMsg.textContent = "Shranjevanje ni uspelo. Poskusi znova.";
            return;
          }
          var updated = (res.data && res.data.user) || window.PTOMSETU_USER;
          window.PTOMSETU_USER = updated;
          applyUser(updated);
        })
        .catch(function () {
          if (saveBtn) saveBtn.disabled = false;
          if (userNameFormMsg) userNameFormMsg.textContent = "Napaka pri povezavi. Poskusi znova.";
        });
    });
  }

  function closeAvatarPopover() {
    if (userAvatarPopover) userAvatarPopover.hidden = true;
    if (userAvatarBtn) userAvatarBtn.setAttribute("aria-expanded", "false");
  }
  // Izpostavljeno navzven, da lahko dashboard.js zapre meni ob kliku na
  // "Uredi razpored" (auth.js in dashboard.js sta ločena, brez uvozov).
  window.ptomsetuCloseAvatarPopover = closeAvatarPopover;

  if (userAvatarBtn) {
    userAvatarBtn.addEventListener("click", function () {
      var open = userAvatarBtn.getAttribute("aria-expanded") === "true";
      userAvatarBtn.setAttribute("aria-expanded", String(!open));
      if (userAvatarPopover) userAvatarPopover.hidden = open;
    });
  }
  // pointerdown namesto click: na iOS Safari se sintetični "click" na
  // navadnih (neinteraktivnih) elementih ne sproži zanesljivo ob dotiku,
  // zato se meni na telefonu ni zapiral ob dotiku zunaj njega.
  document.addEventListener("pointerdown", function (e) {
    if (!userAvatarPopover || userAvatarPopover.hidden) return;
    if (e.target === userAvatarBtn || userAvatarBtn.contains(e.target)) return;
    if (userAvatarPopover.contains(e.target)) return;
    closeAvatarPopover();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAvatarPopover();
  });

  /* ---------- Preverjanje / spremljanje seje ---------- */

  function onSession(session) {
    if (session && recoveryMode) {
      // PTOMSETU_SESSION namenoma ne nastavimo — dashboard.js bi sicer
      // naložil ploščo, preden je novo geslo nastavljeno.
      showAuth();
      setTab("newPassword");
      return;
    }
    if (session) {
      window.PTOMSETU_USER = session.user;
      window.PTOMSETU_SESSION = session;
      applyUser(session.user);
      showApp();
      document.dispatchEvent(new CustomEvent("ptomsetu:signed-in", { detail: { session: session } }));
    } else {
      window.PTOMSETU_USER = null;
      window.PTOMSETU_SESSION = null;
      closeAvatarPopover();
      showAuth();
      // S povezavo z vabilom pride nekdo, da se registrira.
      setTab(invite ? "register" : "login");
      document.dispatchEvent(new CustomEvent("ptomsetu:signed-out"));
    }
  }

  showLoading();

  // Varnostni izklop: če getSession() obtiči (počasno/nezanesljivo omrežje,
  // npr. na telefonu), stran ne sme obviseti na zaslonu za nalaganje v
  // nedogled — po nekaj sekundah raje pokaže prijavo. clearTimeout spodaj
  // to prekliče, brž ko dobimo pravi odgovor (tudi če pride kasneje —
  // onSession() takrat uporabnika vseeno pravilno spusti naprej).
  var initialTimeout = setTimeout(function () {
    showFormMessage(loginForm, "Preverjanje prijave traja dlje kot običajno. Poskusi znova, če se ne naloži.", false);
    onSession(null);
  }, 8000);

  sb.auth
    .getSession()
    .then(function (res) {
      clearTimeout(initialTimeout);
      onSession(res.data && res.data.session);
    })
    .catch(function () {
      clearTimeout(initialTimeout);
      showFormMessage(loginForm, "Preverjanje prijave ni uspelo. Preveri povezavo in poskusi znova.", true);
      onSession(null);
    });

  sb.auth.onAuthStateChange(function (event, session) {
    // INITIAL_SESSION je začetni "sinhronizacijski" dogodek, ki ga supabase-js
    // sproži takoj ob registraciji tega listenerja — to začetno stanje že
    // obravnava getSession() klic zgoraj. Če bi ga tudi tu obravnavali, se
    // lahko (odvisno od trenutka nalaganja shranjene seje) sproži z null,
    // preden je seja iz localStorage do konca prebrana — to bi uporabnika
    // videti kot odjavljenega, čeprav je prijavljen, in počistilo nadzorno
    // ploščo. Zato tu reagiramo samo na PRAVE naknadne spremembe.
    if (event === "INITIAL_SESSION") return;
    // Za primer, ko naslov nima "type=recovery" (npr. PKCE "?code=..."),
    // supabase-js ob prihodu prek povezave za ponastavitev sproži ta dogodek.
    if (event === "PASSWORD_RECOVERY") recoveryMode = true;
    clearTimeout(initialTimeout);
    onSession(session);
  });
})();

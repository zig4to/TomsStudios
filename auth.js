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

  var sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  window.sb = sb;
  window.PTOMSETU_USER = null;

  /* ---------- Zavihka Prijava / Registracija ---------- */

  var tabLogin = document.getElementById("tabLogin");
  var tabRegister = document.getElementById("tabRegister");
  var loginForm = document.getElementById("loginForm");
  var registerForm = document.getElementById("registerForm");

  function setTab(which) {
    var isLogin = which === "login";
    if (tabLogin) tabLogin.setAttribute("aria-selected", String(isLogin));
    if (tabRegister) tabRegister.setAttribute("aria-selected", String(!isLogin));
    if (loginForm) loginForm.hidden = !isLogin;
    if (registerForm) registerForm.hidden = isLogin;
  }
  if (tabLogin) tabLogin.addEventListener("click", function () { setTab("login"); });
  if (tabRegister) tabRegister.addEventListener("click", function () { setTab("register"); });

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
      return "Ta e-poštni naslov ni na seznamu povabljenih.";
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
            data: { first_name: firstName, last_name: lastName }
          }
        })
        .then(function (res) {
          if (res.error) {
            showFormMessage(registerForm, friendlySignupError(res.error), true);
          } else if (res.data && res.data.user && !res.data.session) {
            showFormMessage(registerForm, "Račun je ustvarjen. Preveri e-pošto in potrdi račun, nato se prijavi.", false);
          }
        })
        .catch(function () { showFormMessage(registerForm, "Registracija ni uspela. Poskusi znova.", true); })
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

  // Prazen niz, če ni shranjenega pravega imena (star račun) — takrat se v
  // pojavnem oknu prikaže samo e-pošta, ne podvojeno še enkrat kot "ime".
  function displayNameFor(user) {
    var meta = (user && user.user_metadata) || {};
    var first = (meta.first_name || "").trim();
    var last = (meta.last_name || "").trim();
    return (first + " " + last).trim();
  }

  function initialsFor(user) {
    var meta = (user && user.user_metadata) || {};
    var first = (meta.first_name || "").trim();
    var last = (meta.last_name || "").trim();
    if (first || last) {
      return ((first.charAt(0) || "") + (last.charAt(0) || "")).toUpperCase() || "?";
    }
    // Star račun brez shranjenega imena — začetnici iz e-pošte kot nadomestilo.
    var email = (user && user.email) || "";
    return email.slice(0, 2).toUpperCase() || "?";
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
    if (session) {
      window.PTOMSETU_USER = session.user;
      window.PTOMSETU_SESSION = session;
      if (userAvatarInitials) userAvatarInitials.textContent = initialsFor(session.user);
      if (userAvatarName) {
        var fullName = displayNameFor(session.user);
        userAvatarName.textContent = fullName;
        userAvatarName.hidden = !fullName;
      }
      if (userAvatarEmail) userAvatarEmail.textContent = session.user.email || "";
      showApp();
      document.dispatchEvent(new CustomEvent("ptomsetu:signed-in", { detail: { session: session } }));
    } else {
      window.PTOMSETU_USER = null;
      window.PTOMSETU_SESSION = null;
      closeAvatarPopover();
      showAuth();
      setTab("login");
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
    clearTimeout(initialTimeout);
    onSession(session);
  });
})();

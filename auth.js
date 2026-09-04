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
      var password = loginForm.querySelector('input[type="password"]').value;
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
      var email = registerForm.querySelector('input[type="email"]').value.trim();
      var password = registerForm.querySelector('input[type="password"]').value;
      var btn = registerForm.querySelector(".auth-submit");
      if (btn) btn.disabled = true;
      // emailRedirectTo: potrditvena povezava v e-pošti pripelje nazaj sem —
      // na isto stran/izvor, s katerega se je nekdo registriral (lokalno v
      // razvoju ali na dejanski objavljeni domeni), namesto na privzeti
      // "Site URL" iz Supabase nastavitev. Ta naslov mora biti vnaprej dodan
      // v Supabase: Authentication → URL Configuration → Redirect URLs.
      sb.auth
        .signUp({
          email: email,
          password: password,
          options: { emailRedirectTo: location.origin + location.pathname }
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

  /* ---------- Odjava ---------- */

  var logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      sb.auth.signOut();
    });
  }

  /* ---------- Preverjanje / spremljanje seje ---------- */

  function onSession(session) {
    var userEmailLabel = document.getElementById("userEmailLabel");
    if (session) {
      window.PTOMSETU_USER = session.user;
      if (userEmailLabel) userEmailLabel.textContent = session.user.email || "";
      showApp();
      document.dispatchEvent(new CustomEvent("ptomsetu:signed-in", { detail: { session: session } }));
    } else {
      window.PTOMSETU_USER = null;
      if (userEmailLabel) userEmailLabel.textContent = "";
      showAuth();
      setTab("login");
      document.dispatchEvent(new CustomEvent("ptomsetu:signed-out"));
    }
  }

  showLoading();
  sb.auth.getSession().then(function (res) {
    onSession(res.data && res.data.session);
  });
  sb.auth.onAuthStateChange(function (_event, session) {
    onSession(session);
  });
})();

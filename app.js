/* Pr'Tomšetu — hub aplikacij */
(function () {
  "use strict";

  var root = document.documentElement;
  var label = document.getElementById("themeLabel");

  function paintLabel(theme) {
    if (label) label.textContent = theme === "dark" ? "Temna tema" : "Svetla tema";
  }

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0b1020" : "#f6f7fb");
    paintLabel(theme);
    try { localStorage.setItem("ptomsetu-theme", theme); } catch (e) { /* private mode */ }
  }

  paintLabel(root.getAttribute("data-theme"));

  var toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });
  }

  // Gumb Nastavitve razgrne ploščo pod sabo.
  var settingsBtn = document.getElementById("settingsBtn");
  var panel = document.getElementById("settingsPanel");
  if (settingsBtn && panel) {
    settingsBtn.addEventListener("click", function () {
      var open = settingsBtn.getAttribute("aria-expanded") === "true";
      settingsBtn.setAttribute("aria-expanded", String(!open));
      panel.hidden = open;
    });
  }

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();

/* Pr'Tomšetu — hub aplikacij */
(function () {
  "use strict";

  var root = document.documentElement;

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0b1020" : "#f6f7fb");
    try { localStorage.setItem("ptomsetu-theme", theme); } catch (e) { /* private mode */ }
  }

  var toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });
  }

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();

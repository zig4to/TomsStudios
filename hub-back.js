/* Bitneverse — gumb „nazaj na ploščo“ za aplikacije na zig4to.github.io.
   Nameščena plošča (manifest scope = cel zig4to.github.io) odpira te aplikacije
   v svojem oknu brez vrstice brskalnika; iPhone tam nima gumba nazaj.
   Plošča v tem oknu nastavi sessionStorage „bitneverse-hub“ (dashboard.js);
   samostojno nameščena aplikacija ima svoje okno brez te oznake → gumba ni.
   Vključi: <script src="/TomsStudios/hub-back.js" defer></script> */
(function () {
  "use strict";
  if (window.__bitneverseBack) return;
  window.__bitneverseBack = true;
  if (/^\/TomsStudios(\/|$)/.test(location.pathname)) return;

  var standalone = (window.matchMedia && (matchMedia("(display-mode: standalone)").matches ||
    matchMedia("(display-mode: fullscreen)").matches || matchMedia("(display-mode: minimal-ui)").matches)) ||
    window.navigator.standalone === true;
  var fromHub = false;
  try { fromHub = sessionStorage.getItem("bitneverse-hub") === "1"; } catch (e) {}
  if (!standalone || !fromHub) return;

  var POS_KEY = "bitneverse-back-y";

  function mount() {
    if (document.getElementById("bitneverseBack")) return;
    var css = document.createElement("style");
    css.textContent =
      "#bitneverseBack{position:fixed;left:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;" +
      "width:30px;height:52px;padding:0 3px 0 0;border:0;border-radius:0 16px 16px 0;" +
      "background:linear-gradient(160deg,#6366f1,#a855f7 55%,#ec4899);color:#fff;opacity:.82;" +
      "box-shadow:0 6px 18px -6px rgba(0,0,0,.55);cursor:pointer;touch-action:none;-webkit-tap-highlight-color:transparent;" +
      "transition:opacity .2s ease,width .2s ease}" +
      "#bitneverseBack:hover,#bitneverseBack:focus-visible{opacity:1;width:36px;outline:none}" +
      "#bitneverseBack svg{width:18px;height:18px;pointer-events:none}" +
      "@media print{#bitneverseBack{display:none}}";
    document.head.appendChild(css);

    var b = document.createElement("button");
    b.id = "bitneverseBack";
    b.type = "button";
    b.title = "Nazaj na Bitneverse";
    b.setAttribute("aria-label", "Nazaj na ploščo Bitneverse");
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';

    // navpično premakljiv (da ne prekrije gumbov aplikacije); položaj si zapomni
    var y = 0.5;
    try { var s = parseFloat(localStorage.getItem(POS_KEY)); if (s >= 0.08 && s <= 0.92) y = s; } catch (e) {}
    function place() { b.style.top = "calc(" + (y * 100).toFixed(2) + "% - 26px)"; }
    place();

    var startY = 0, startPos = 0, moved = false, down = false;
    b.addEventListener("pointerdown", function (e) {
      down = true; moved = false; startY = e.clientY; startPos = y;
      try { b.setPointerCapture(e.pointerId); } catch (err) {}
    });
    b.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dy = e.clientY - startY;
      if (Math.abs(dy) > 6) moved = true;
      if (!moved) return;
      y = Math.min(0.92, Math.max(0.08, startPos + dy / window.innerHeight));
      place();
    });
    function end() {
      if (!down) return;
      down = false;
      if (moved) { try { localStorage.setItem(POS_KEY, String(y)); } catch (e) {} }
    }
    b.addEventListener("pointerup", end);
    b.addEventListener("pointercancel", end);
    b.addEventListener("click", function (e) {
      if (moved) { e.preventDefault(); moved = false; return; }
      location.href = "/TomsStudios/";
    });
    document.body.appendChild(b);
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();

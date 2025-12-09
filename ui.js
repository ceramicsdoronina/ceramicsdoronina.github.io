// ui.js
(function () {

  function initNavbarToggle() {
    const body = document.body;
    const toggle = document.getElementById("nav-toggle");
    if (!toggle) return;
    toggle.addEventListener("click", () => {
      const isOpen = body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  function setViewMode(mode) {
    if (mode === "mobile") document.body.classList.add("mobile-view");
    else document.body.classList.remove("mobile-view");
    localStorage.setItem("cd_view", mode);
  }

  function initViewToggle() {
    const saved = localStorage.getItem("cd_view");
    if (saved === "mobile" || saved === "desktop") {
      setViewMode(saved);
    }

    const btn = document.getElementById("view-toggle-btn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const now = document.body.classList.contains("mobile-view") ? "desktop" : "mobile";
      setViewMode(now);
      btn.textContent = now === "mobile" ? "Desktop" : "Mobile";
    });
  }

  window.CD = window.CD || {};
  window.CD.ui = {
    initNavbarToggle,
    initViewToggle
  };
})();


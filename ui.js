// ui.js
(function () {

  function initNavbarAutoClose() {
    document.addEventListener("click", (e) => {
      if (!document.body.classList.contains("nav-open")) return;
  
      const clickedToggle = e.target.closest("#nav-toggle, .nav-toggle-btn");
      const clickedInsideMenu = e.target.closest("header nav ul");
  
      // Non chiudere se sto cliccando sul bottone hamburger o dentro al menu
      if (clickedToggle || clickedInsideMenu) return;
  
      // Chiudi in tutti gli altri casi (fuori header + dentro header ma fuori menu)
      document.body.classList.remove("nav-open");
    });
  
    // Chiudi anche quando clicchi su una voce del menu
    document.addEventListener("click", (e) => {
      const link = e.target.closest("header nav a");
      if (!link) return;
      document.body.classList.remove("nav-open");
    });
  
    // ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.body.classList.remove("nav-open");
      }
    });
  }

  function initNavbarToggle() {
    const body = document.body;
    const toggle = document.querySelector("header #nav-toggle") ||
               document.querySelector("header .nav-toggle-btn");
    const navUl = document.querySelector("header nav ul");
  
    console.log("🔍 [UI] Inizializzazione navbar toggle");
    console.log("🔍 [UI] Toggle button trovato:", !!toggle);
    console.log("🔍 [UI] Nav ul trovato:", !!navUl);
  
    if (!toggle) {
      console.warn("❌ [UI] Toggle button non trovato");
      return;
    }
    
    if (!navUl) {
      console.warn("❌ [UI] Nav ul non trovato");
      return;
    }
  
    // Evita listener duplicati
    if (toggle.dataset.bound === "1") {
      console.log("✅ [UI] Toggle già inizializzato");
      return;
    }
    toggle.dataset.bound = "1";
  
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const wasOpen = body.classList.contains("nav-open");
      body.classList.toggle("nav-open");
      const isOpen = body.classList.contains("nav-open");
      
      console.log("🔍 [UI] Toggle cliccato");
      console.log("🔍 [UI] Era aperto:", wasOpen);
      console.log("🔍 [UI] Ora aperto:", isOpen);
      console.log("🔍 [UI] Body classes:", body.className);
      console.log("🔍 [UI] Nav ul display:", window.getComputedStyle(navUl).display);
      
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    
    console.log("✅ [UI] Navbar toggle inizializzato");
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
    initNavbarAutoClose,
    initViewToggle
  };
})();

// --- Likes (globali) ---
(function () {
  const LIKE_KEY = "cd_likes_v1";

  function getLikes() {
    try { return new Set(JSON.parse(localStorage.getItem(LIKE_KEY) || "[]")); }
    catch { return new Set(); }
  }

  function setLikes(set) {
    localStorage.setItem(LIKE_KEY, JSON.stringify([...set]));
  }

  function toggleLike(key) {
    const likes = getLikes();
    if (likes.has(key)) likes.delete(key);
    else likes.add(key);
    setLikes(likes);
    return likes;
  }

  function isLiked(key) {
    return getLikes().has(key);
  }

  window.CD = window.CD || {};
  window.CD.likes = { getLikes, toggleLike, isLiked };
})();

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-like-key]");
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  const key = btn.getAttribute("data-like-key");
  const likes = window.CD.likes.toggleLike(key);
  btn.textContent = likes.has(key) ? "♥" : "♡";

  // se hai una sezione preferiti, aggiornala
  window.CD?.likedSection?.render?.();
});


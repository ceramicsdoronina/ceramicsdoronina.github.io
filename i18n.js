// i18n.js
(function () {
  const messages = window.messages;  // preso da messages.js
  let currentLang = "it";

  function storageGet(key) {
    try { return localStorage.getItem(key); }
    catch (err) { console.warn("[i18n] localStorage non leggibile:", err); return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); }
    catch (err) { console.warn("[i18n] localStorage non scrivibile:", err); }
  }

  function detectInitialLang() {
    const saved = storageGet("cd_lang");
    if (saved && messages[saved]) return saved;
    const browser = (navigator.language || navigator.userLanguage || "it").slice(0, 2);
    if (messages[browser]) return browser;
    return "it";
  }

  // Unico accessore della lingua corrente (it | en | ru), usato da tutti i moduli.
  function getCurrentLang() {
    return currentLang;
  }

  // Unica funzione di lookup per chiave "a.b.c"; null se assente.
  function lookup(dict, keyPath) {
    let cur = dict;
    for (const p of String(keyPath).split(".")) cur = cur && cur[p];
    return typeof cur === "string" ? cur : null;
  }

  // Traduzione per chiave nella lingua indicata (default: corrente); se manca, fallback it.
  function t(keyPath, lang) {
    const dict = messages[lang || currentLang] || messages.it || {};
    const val = lookup(dict, keyPath);
    return val !== null ? val : lookup(messages.it || {}, keyPath);
  }

  function applyTranslations(lang) {
    const dict = messages[lang];
    if (!dict) return;

    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach(el => {
      const val = lookup(dict, el.getAttribute("data-i18n"));
      if (val !== null) el.textContent = val;
    });

    // attributi aria-label tradotti: data-i18n-aria-label="chiave"
    document.querySelectorAll("[data-i18n-aria-label]").forEach(el => {
      const val = lookup(dict, el.getAttribute("data-i18n-aria-label"));
      if (val !== null) el.setAttribute("aria-label", val);
    });

    // link che seguono la lingua: data-i18n-href="chiave" (il valore e' un percorso relativo)
    document.querySelectorAll("[data-i18n-href]").forEach(el => {
      const val = lookup(dict, el.getAttribute("data-i18n-href"));
      if (val !== null) el.setAttribute("href", val);
    });

    syncLangMenu(lang);
  }

  // ── selettore lingua: testo semplice ("RU") + piccolo menu a tendina, senza cornice ne' bandiere ──
  function langOptions() {
    return Array.from(document.querySelectorAll("#language-list [data-lang]"));
  }

  function syncLangMenu(lang) {
    const el = document.getElementById("language-selector");
    if (el && el.tagName === "SELECT") { el.value = lang; return; }   // vecchio markup con <select>
    const cur = document.getElementById("language-current");
    if (cur) cur.textContent = String(lang).toUpperCase();
    langOptions().forEach((o) => o.setAttribute("aria-selected", o.dataset.lang === lang ? "true" : "false"));
  }

  function bindLangMenu() {
    const btn = document.getElementById("language-selector");
    if (!btn) return;
    if (btn.tagName === "SELECT") {   // vecchio markup con <select>
      btn.value = currentLang;
      btn.addEventListener("change", (e) => setLanguage(e.target.value));
      return;
    }
    const list = document.getElementById("language-list");
    if (!list) return;
    const menu = document.getElementById("lang-menu") || btn.parentElement;
    let idx = 0, byHover = false, hoverTimer = null;

    function focusOption() {
      const opts = langOptions();
      opts.forEach((o, i) => { o.tabIndex = i === idx ? 0 : -1; });
      if (opts[idx]) { opts[idx].focus(); list.setAttribute("aria-activedescendant", opts[idx].id); }
    }
    function open() {   // da clic o tastiera: il focus passa sulla voce corrente
      byHover = false;
      list.hidden = false; btn.setAttribute("aria-expanded", "true");
      idx = Math.max(0, langOptions().findIndex((o) => o.dataset.lang === currentLang));
      focusOption();
    }
    function close(returnFocus) {
      byHover = false;
      list.hidden = true; btn.setAttribute("aria-expanded", "false");
      list.removeAttribute("aria-activedescendant");
      if (returnFocus) btn.focus();
    }
    function choose(o) {
      if (o) setLanguage(o.dataset.lang);
      close(true);
    }

    // mouse: il menu si apre appena il puntatore e' sulla lingua e si chiude quando esce (solo dispositivi con hover)
    const canHover = !!(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    if (canHover) {
      menu.addEventListener("mouseenter", () => {
        clearTimeout(hoverTimer);
        if (list.hidden) { byHover = true; list.hidden = false; btn.setAttribute("aria-expanded", "true"); }
      });
      menu.addEventListener("mouseleave", () => {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => { if (!list.hidden && byHover) close(false); }, 180);
      });
    }

    btn.addEventListener("click", () => {
      if (list.hidden) open();
      else if (byHover) { /* gia' aperto dal mouse: il clic non lo chiude, si chiudera' quando il mouse esce */ }
      else close(false);
    });
    btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (list.hidden) open(); }
    });
    list.addEventListener("click", (e) => { const o = e.target.closest("[data-lang]"); if (o) choose(o); });
    list.addEventListener("keydown", (e) => {
      const n = langOptions().length;
      if (e.key === "ArrowDown") { e.preventDefault(); idx = (idx + 1) % n; focusOption(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); idx = (idx - 1 + n) % n; focusOption(); }
      else if (e.key === "Home") { e.preventDefault(); idx = 0; focusOption(); }
      else if (e.key === "End") { e.preventDefault(); idx = n - 1; focusOption(); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(langOptions()[idx]); }
      else if (e.key === "Escape") { e.preventDefault(); close(true); }
      else if (e.key === "Tab") { close(false); }
    });
    document.addEventListener("click", (e) => { if (!list.hidden && !e.target.closest("#lang-menu")) close(false); });
  }

  function setLanguage(lang) {
    if (!messages[lang]) return;

    currentLang = lang;
    storageSet("cd_lang", lang);

    // 1) prima applico le traduzioni statiche (data-i18n)
    applyTranslations(lang);

    // 2) poi ricostruisco le parti dinamiche nella nuova lingua (ogni sezione in try/catch dentro
    //    CD.app.renderData; i dati non caricati mostrano il messaggio "non disponibile" tradotto)
    // 3) infine il drawer del carrello, anche se il rendering e' fallito
    try {
      if (window.CD && CD.app && CD.app.renderData) CD.app.renderData(lang);
    } catch (err) {
      console.error("[i18n] rendering dopo cambio lingua fallito:", err);
    } finally {
      if (window.CD && CD.shop && CD.shop.renderDrawer) CD.shop.renderDrawer();
    }
  }

  function initLanguage() {
    currentLang = detectInitialLang();
    applyTranslations(currentLang);

    bindLangMenu();
  }

  // esponiamo nell’oggetto globale
  window.CD = window.CD || {};
  window.CD.i18n = {
    initLanguage,
    setLanguage,
    applyTranslations,
    getCurrentLang,
    t,
    messages
  };
})();

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

  // Traduzione per chiave "a.b.c" nella lingua corrente (fallback it); null se assente.
  function t(keyPath, lang) {
    const dict = messages[lang || currentLang] || messages.it || {};
    const val = String(keyPath).split(".").reduce((o, k) => (o && o[k] != null ? o[k] : null), dict);
    return typeof val === "string" ? val : null;
  }

  function lookup(dict, keyPath) {
    let cur = dict;
    for (const p of String(keyPath).split(".")) cur = cur && cur[p];
    return typeof cur === "string" ? cur : null;
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

    const langSelect = document.getElementById("language-selector");
    if (langSelect) langSelect.value = lang;
  }

  function setLanguage(lang) {
    if (!messages[lang]) return;

    currentLang = lang;
    storageSet("cd_lang", lang);

    // 1) prima applico le traduzioni statiche (data-i18n)
    applyTranslations(lang);

    // 2) poi ricostruisco le parti dinamiche nella nuova lingua
    if (window.__catalogueData && window.CD && CD.catalogue) {
      CD.catalogue.render(window.__catalogueData, lang);
      CD.catalogue.initBehaviour();  // modali/gallerie dei nuovi nodi
    }

    if (window.__masterclassData && window.CD && CD.masterclass) {
      CD.masterclass.render(window.__masterclassData, lang);
    }

    if (window.__certificatiData && window.CD && CD.certificati) {
      CD.certificati.render(window.__certificatiData, lang);
    }

    // 3) infine il drawer del carrello (testi, nomi righe, pulsante)
    if (window.CD && CD.shop && CD.shop.renderDrawer) CD.shop.renderDrawer();
  }

  function initLanguage() {
    currentLang = detectInitialLang();
    applyTranslations(currentLang);

    const langSelect = document.getElementById("language-selector");
    if (langSelect) {
      langSelect.value = currentLang;
      langSelect.addEventListener("change", e => setLanguage(e.target.value));
    }
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

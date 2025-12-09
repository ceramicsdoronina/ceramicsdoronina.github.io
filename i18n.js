// i18n.js
(function () {
  const messages = window.messages;  // preso da messages.js
  let currentLang = "it";

  function detectInitialLang() {
    const saved = localStorage.getItem("cd_lang");
    if (saved && messages[saved]) return saved;
    const browser = (navigator.language || navigator.userLanguage || "it").slice(0, 2);
    if (messages[browser]) return browser;
    return "it";
  }

  function applyTranslations(lang) {
    const dict = messages[lang];
    if (!dict) return;

    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach(el => {
      const path = el.getAttribute("data-i18n").split(".");
      let cur = dict;
      for (const p of path) cur = cur && cur[p];
      if (typeof cur === "string") el.textContent = cur;
    });

    const langSelect = document.getElementById("language-selector");
    if (langSelect) langSelect.value = lang;
  }

  function setLanguage(lang) {
    if (!messages[lang]) return;
    currentLang = lang;
    localStorage.setItem("cd_lang", lang);
    applyTranslations(lang);

    if (window.__catalogueData && window.CD && CD.catalogue) {
      CD.catalogue.render(window.__catalogueData, lang);
    }
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
    getCurrentLang: () => currentLang,
    messages
  };
})();

